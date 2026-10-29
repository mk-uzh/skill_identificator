# Databricks notebook source
# %% [markdown]
# # SLV 01 — build the silver entities
# Reads bronze, merges identities, resolves the keys and writes pseudonymised
# tables. No names and no e-mail addresses leave this notebook.

# %%
import sys, json, re, hashlib, collections
from pathlib import Path
ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents]
            if (p / "src" / "devskill").exists())
sys.path.insert(0, str(ROOT / "src"))
from devskill.config import Config, PIPELINE_ROOT
from devskill import db
from devskill.identity import build, write_mapping, _salt, is_bot

cfg = Config()
SALT = _salt(PIPELINE_ROOT, cfg.data_root)
bro = db.connect(cfg.path("sqlite_bronze"))
sil = db.connect(cfg.path("sqlite_silver"))
db.run_script(sil, ROOT / "sql" / "01_silver.sql")
print(cfg)


def h(value: str) -> str:
    """Same salted hash as for developers, for accounts we cannot resolve."""
    return hashlib.sha256((SALT + (value or "").lower()).encode()).hexdigest()[:16]


def log(step, n, params=None):
    db.upsert(sil, "tbl_slv_build_log", {
        "step": step, "built_at": db.now(),
        "params": json.dumps(params or {}, ensure_ascii=False), "n_rows": n})
    sil.commit()
    print(f"  {step:24}{n:>8} rows")


# %% --- developers --------------------------------------------------------
pairs = bro.execute("SELECT author_name, author_email FROM tbl_brz_gh_commit").fetchall()
mapping, people = build(pairs, PIPELINE_ROOT, cfg.data_root)
write_mapping(people, cfg.data_root / "mapping.secrets.json")
threshold = cfg.scope.get("min_commits", 10)

dates = collections.defaultdict(list)
for name, email, ts in bro.execute(
        "SELECT author_name, author_email, authored_at FROM tbl_brz_gh_commit"):
    dates[mapping[(name.lower(), (email or "").lower())]].append(ts or "")

for p in people.values():
    ds = sorted(x for x in dates.get(p["dev_id"], []) if x)
    db.upsert(sil, "tbl_slv_developer", {
        "dev_id": p["dev_id"], "dev_hash": p["dev_hash"],
        "n_commits": p["n_commits"], "n_identities": len(p["names"]),
        "first_commit_at": ds[0][:19] if ds else None,
        "last_commit_at": ds[-1][:19] if ds else None,
        "is_bot": int(p["is_bot"]),
        "in_scope": int(p["n_commits"] >= threshold and not p["is_bot"])})
sil.commit()
log("developer", len(people), {"min_commits": threshold})


def dev_of(name, email):
    return mapping.get(((name or "").lower(), (email or "").lower()))


# %% --- resolve GitHub logins to dev_id -----------------------------------
# a) noreply addresses carry the login:  12345+login@users.noreply.github.com
login2dev = {}
for p in people.values():
    for e in p["emails"]:
        m = re.match(r"(?:\d+\+)?([A-Za-z0-9-]+)@users\.noreply\.github\.com$", e or "")
        if m:
            login2dev[m.group(1).lower()] = p["dev_id"]
by_email = len(login2dev)

# b) a pull request is usually authored by whoever committed against it
pr_dev = {}
for subject, name, email in bro.execute(
        "SELECT subject, author_name, author_email FROM tbl_brz_gh_commit"):
    m = re.search(r"#(\d+)", subject or "")
    if m:
        pr_dev.setdefault(int(m.group(1)), dev_of(name, email))
for (p,) in bro.execute("SELECT payload FROM tbl_brz_gh_pull"):
    d = json.loads(p)
    lg = ((d.get("user") or {}).get("login") or "").lower()
    dv = pr_dev.get(d.get("number"))
    if lg and dv and lg not in login2dev:
        login2dev[lg] = dv
print(f"  logins resolved: {len(login2dev)} "
      f"({by_email} via noreply address, {len(login2dev)-by_email} via linked commits)")


def dev_of_login(login):
    return login2dev.get((login or "").lower())


# %% --- issues ------------------------------------------------------------
name2dev = {n.lower(): p["dev_id"] for p in people.values() for n in p["names"]}
n_comp = n_lab = 0
for key, payload in bro.execute("SELECT issue_key, payload FROM tbl_brz_ji_issue"):
    f = json.loads(payload).get("fields", {})
    rep = (f.get("reporter") or {}).get("displayName") or ""
    asg = (f.get("assignee") or {}).get("displayName") or ""
    db.upsert(sil, "tbl_slv_issue", {
        "issue_key": key,
        "issue_type": (f.get("issuetype") or {}).get("name"),
        "status": (f.get("status") or {}).get("name"),
        "resolution": (f.get("resolution") or {}).get("name"),
        "priority": (f.get("priority") or {}).get("name"),
        "summary": f.get("summary"),
        "description": f.get("description"),
        "created_at": (f.get("created") or "")[:19],
        "updated_at": (f.get("updated") or "")[:19],
        "resolved_at": (f.get("resolutiondate") or "")[:19] or None,
        "reporter_dev_id": name2dev.get(rep.lower()),
        "reporter_acct_hash": h(rep) if rep else None,
        "assignee_dev_id": name2dev.get(asg.lower()),
        "assignee_acct_hash": h(asg) if asg else None,
        "n_comments": len((f.get("comment") or {}).get("comments", []) or [])})
    for c in f.get("components") or []:
        db.upsert(sil, "tbl_slv_issue_component",
                  {"issue_key": key, "component": c.get("name")}); n_comp += 1
    for l in f.get("labels") or []:
        db.upsert(sil, "tbl_slv_issue_label", {"issue_key": key, "label": l}); n_lab += 1
sil.commit()
log("issue", sil.execute("SELECT COUNT(*) FROM tbl_slv_issue").fetchone()[0])
log("issue_component", n_comp)
log("issue_label", n_lab)

for cid, key, payload in bro.execute(
        "SELECT comment_id, issue_key, payload FROM tbl_brz_ji_comment"):
    c = json.loads(payload)
    who = (c.get("author") or {}).get("displayName") or ""
    db.upsert(sil, "tbl_slv_issue_comment", {
        "comment_id": cid, "issue_key": key,
        "author_dev_id": name2dev.get(who.lower()),
        "author_acct_hash": h(who) if who else None,
        "created_at": (c.get("created") or "")[:19],
        "body": c.get("body"),
        "is_bot": int(is_bot(who, ""))})
sil.commit()
log("issue_comment", sil.execute("SELECT COUNT(*) FROM tbl_slv_issue_comment").fetchone()[0])

# %% --- commits, files, patches -------------------------------------------
known_issues = {r[0] for r in sil.execute("SELECT issue_key FROM tbl_slv_issue")}
pkey = cfg.project["jira_project_key"]
w_start, w_end = cfg.window["start"], cfg.window["end"]
AI = re.compile(r"claude|cursor|copilot|chatgpt|gpt-|gemini|devin|coderabbit", re.I)

LANG = {"java": "Java", "js": "JavaScript", "mjs": "JavaScript", "ts": "TypeScript",
        "jsx": "JavaScript", "tsx": "TypeScript", "vue": "Vue", "scss": "SCSS",
        "css": "CSS", "html": "HTML", "jsp": "JSP", "vm": "Velocity", "xml": "XML",
        "sql": "SQL", "py": "Python", "sh": "Shell", "yml": "YAML", "yaml": "YAML",
        "json": "JSON", "md": "Markdown", "properties": "Properties"}


def layer_of(path: str) -> str:
    p = path.lower()
    if "/test/" in p or "e2e-tests/" in p or re.search(r"(test|tests|spec)\.(java|js|ts)$", p):
        return "testing"
    if p.endswith(".sql") or ".hbm.xml" in p or "/dao/" in p or "hibernate" in p:
        return "persistence"
    if p.endswith(".properties"):
        return "i18n"
    if re.search(r"\.(js|jsx|ts|tsx|vue|scss|css|html|hbs|jsp|vm)$", p) or "/webapp/" in p:
        return "frontend"
    if re.search(r"(pom\.xml|\.ya?ml|dockerfile|components\.xml|\.sh)$", p) or ".github/" in p:
        return "infra_config"
    if p.endswith(".md") or p.endswith(".txt"):
        return "docs"
    if re.search(r"\.(java|kt|groovy|py)$", p):
        return "backend"
    return "other"


n_files = 0
for sha, name, email, ts, subject, payload in bro.execute(
        "SELECT sha, author_name, author_email, authored_at, subject, payload "
        "FROM tbl_brz_gh_commit"):
    c = json.loads(payload)
    mk = re.search(rf"{pkey}-\d+", subject or "")
    mp = re.search(r"#(\d+)", subject or "")
    trailers = " ".join(t.get("value", "") for t in c.get("trailers", []))
    tool = AI.search(trailers)
    issue_key = mk.group(0) if mk else None
    db.upsert(sil, "tbl_slv_commit", {
        "sha": sha, "dev_id": dev_of(name, email), "issue_key": issue_key,
        "pr_number": int(mp.group(1)) if mp else None,
        "authored_at": (ts or "")[:19], "subject": subject, "body": c.get("body"),
        "n_files": len(c.get("files") or []), "is_merge": int(bool(c.get("is_merge"))),
        "is_ai_assisted": int(bool(tool)), "ai_tool": tool.group(0).lower() if tool else None,
        "in_window": int(bool(ts) and w_start <= ts[:10] <= w_end),
        "has_issue": int(issue_key in known_issues if issue_key else 0)})
    for f in c.get("files") or []:
        path = f.get("path") or ""
        ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
        db.upsert(sil, "tbl_slv_commit_file", {
            "sha": sha, "file_path": path, "change_type": f.get("change_type"),
            "language": LANG.get(ext), "module": path.split("/")[0] if "/" in path else None,
            "layer_rule": layer_of(path)})
        n_files += 1
sil.commit()
log("commit", sil.execute("SELECT COUNT(*) FROM tbl_slv_commit").fetchone()[0],
    {"window": cfg.window})
log("commit_file", n_files)

for sha, path, na, nd, tr, lines in bro.execute(
        "SELECT sha, file_path, n_added, n_removed, is_truncated, added_lines "
        "FROM tbl_brz_gh_commit_patch"):
    db.upsert(sil, "tbl_slv_commit_patch", {
        "sha": sha, "file_path": path, "n_added": na, "n_removed": nd,
        "is_truncated": tr, "added_lines": lines})
sil.commit()
log("commit_patch", sil.execute("SELECT COUNT(*) FROM tbl_slv_commit_patch").fetchone()[0])

# %% --- pull requests, reviews, review comments ---------------------------
for (payload,) in bro.execute("SELECT payload FROM tbl_brz_gh_pull"):
    d = json.loads(payload)
    lg = (d.get("user") or {}).get("login") or ""
    mk = re.search(rf"{pkey}-\d+", (d.get("title") or "") + " " + (d.get("body") or ""))
    db.upsert(sil, "tbl_slv_pull_request", {
        "pr_number": d.get("number"), "author_dev_id": dev_of_login(lg),
        "author_login_hash": h(lg) if lg else None,
        "issue_key": mk.group(0) if mk else None,
        "title": d.get("title"), "body": d.get("body"), "state": d.get("state"),
        "is_merged": int(bool(d.get("merged_at"))),
        "created_at": (d.get("created_at") or "")[:19],
        "merged_at": (d.get("merged_at") or "")[:19] or None, "n_reviews": None})
sil.commit()
log("pull_request", sil.execute("SELECT COUNT(*) FROM tbl_slv_pull_request").fetchone()[0])

for pr, payload in bro.execute("SELECT pr_number, payload FROM tbl_brz_gh_review"):
    d = json.loads(payload)
    lg = (d.get("user") or {}).get("login") or ""
    db.upsert(sil, "tbl_slv_review", {
        "review_id": d.get("id"), "pr_number": pr, "reviewer_dev_id": dev_of_login(lg),
        "reviewer_login_hash": h(lg) if lg else None, "state": d.get("state"),
        "submitted_at": (d.get("submitted_at") or "")[:19], "body": d.get("body"),
        "is_bot": int("[bot]" in lg)})
for pr, payload in bro.execute("SELECT pr_number, payload FROM tbl_brz_gh_review_comment"):
    d = json.loads(payload)
    lg = (d.get("user") or {}).get("login") or ""
    db.upsert(sil, "tbl_slv_review_comment", {
        "comment_id": d.get("id"), "pr_number": pr, "reviewer_dev_id": dev_of_login(lg),
        "reviewer_login_hash": h(lg) if lg else None, "file_path": d.get("path"),
        "line_no": d.get("line") or d.get("original_line"),
        "created_at": (d.get("created_at") or "")[:19], "body": d.get("body"),
        "is_bot": int("[bot]" in lg)})
sil.execute("UPDATE tbl_slv_pull_request SET n_reviews = "
            "(SELECT COUNT(*) FROM tbl_slv_review r WHERE r.pr_number = tbl_slv_pull_request.pr_number)")
sil.commit()
log("review", sil.execute("SELECT COUNT(*) FROM tbl_slv_review").fetchone()[0])
log("review_comment", sil.execute("SELECT COUNT(*) FROM tbl_slv_review_comment").fetchone()[0])

# %% --- summary -----------------------------------------------------------
print("\nSilver layer built")
for t in ["tbl_slv_developer", "tbl_slv_commit", "tbl_slv_commit_file",
          "tbl_slv_commit_patch", "tbl_slv_issue", "tbl_slv_issue_component",
          "tbl_slv_issue_label", "tbl_slv_issue_comment", "tbl_slv_pull_request",
          "tbl_slv_review", "tbl_slv_review_comment"]:
    print(f"  {t:26}{db.count(sil, t):>8}")
print("\n  in scope        :",
      sil.execute("SELECT COUNT(*) FROM tbl_slv_developer WHERE in_scope=1").fetchone()[0], "people")
print("  commits linked  :",
      sil.execute("SELECT COUNT(*) FROM tbl_slv_commit WHERE has_issue=1").fetchone()[0])
print("  reviews resolved:",
      sil.execute("SELECT COUNT(*) FROM tbl_slv_review WHERE reviewer_dev_id IS NOT NULL").fetchone()[0],
      "of", db.count(sil, "tbl_slv_review"))
bro.close(); sil.close()
