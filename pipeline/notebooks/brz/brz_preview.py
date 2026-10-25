# Databricks notebook source
# %% [markdown]
# # BRZ — inventory of the bronze layer (pseudonymised)
# What has been collected, how complete is it, and how well does it join.
# People appear only as DEV-01, DEV-02, ... The mapping to real names is written
# locally to pipeline/data/mapping.secrets.json and must not be versioned.

# %%
import sys, json, re, collections, statistics
from pathlib import Path
ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents]
            if (p / "src" / "devskill").exists())
sys.path.insert(0, str(ROOT / "src"))
from devskill.config import Config, PIPELINE_ROOT
from devskill import db
from devskill.identity import build, write_mapping

cfg = Config()
con = db.connect(cfg.path("sqlite_bronze"))
key_prefix = cfg.project["jira_project_key"]


def rule(title):
    print(f"\n{title}\n" + "-" * 72)


# %% --- 1. what is in the database ---
rule("1. Tables")
for t in [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'tbl_brz_%' ORDER BY name")]:
    print(f"  {t:26}{db.count(con, t):>9} rows")

for src, ts, params, n in con.execute(
        "SELECT source, fetched_at, params, n_items FROM tbl_brz_fetch_log ORDER BY log_id"):
    print(f"  fetched {src:14} {ts[:16]}  {n} items")

# %% --- 2. people ---
rule("2. People")
pairs = con.execute("SELECT author_name, author_email FROM tbl_brz_gh_commit").fetchall()
mapping, people = build(pairs, PIPELINE_ROOT)
write_mapping(people, PIPELINE_ROOT / "data" / "mapping.secrets.json")
threshold = cfg.scope.get("min_commits", 10)
in_scope = [p for p in people.values() if p["n_commits"] >= threshold and not p["is_bot"]]
print(f"  merged identities : {len(people)} people "
      f"({sum(1 for p in people.values() if p['is_bot'])} bots)")
print(f"  in scope (>= {threshold} commits, no bot): {len(in_scope)}")
print(f"\n  {'dev_id':9}{'commits':>9}{'identities':>12}")
for p in sorted(people.values(), key=lambda x: -x["n_commits"])[:threshold + 8]:
    flag = "  bot" if p["is_bot"] else ("" if p["n_commits"] >= threshold else "  (below)")
    print(f"  {p['dev_id']:9}{p['n_commits']:>9}{len(p['names']):>12}{flag}")


def dev(name, email):
    return mapping.get(((name or "").lower(), (email or "").lower()), "DEV-??")


# %% --- 3. commits and code ---
rule("3. Commits and code changes")
rows = con.execute("SELECT subject, authored_at FROM tbl_brz_gh_commit").fetchall()
with_key = sum(1 for s, _ in rows if re.search(rf"{key_prefix}-\d+", s or ""))
with_pr = sum(1 for s, _ in rows if re.search(r"#\d+", s or ""))
dates = sorted(d for _, d in rows if d)
print(f"  commits           : {len(rows)}  ({dates[0][:10]} .. {dates[-1][:10]})")
print(f"  with issue key    : {with_key} ({100*with_key//len(rows)} %)")
print(f"  with PR number    : {with_pr} ({100*with_pr//len(rows)} %)")
ai = con.execute("SELECT COUNT(*) FROM tbl_brz_gh_commit "
                 "WHERE json_array_length(json_extract(payload,'$.trailers')) > 0").fetchone()[0]
print(f"  with trailers (e.g. Co-authored-by): {ai}")

n_patch, n_sha, chars = con.execute(
    "SELECT COUNT(*), COUNT(DISTINCT sha), SUM(LENGTH(added_lines)) FROM tbl_brz_gh_commit_patch").fetchone()
print(f"  code excerpts     : {n_patch} files across {n_sha} commits, {(chars or 0)/1e6:.1f} MB")
ext = collections.Counter()
for (p,) in con.execute("SELECT file_path FROM tbl_brz_gh_commit_patch"):
    m = re.search(r"\.([A-Za-z0-9]+)$", p)
    ext[m.group(1).lower() if m else "(none)"] += 1
print("  top file types    : " + ", ".join(f".{k} {v}" for k, v in ext.most_common(8)))

# %% --- 4. pull requests and reviews ---
rule("4. Pull requests, reviews, review comments")
n_pr = db.count(con, "tbl_brz_gh_pull")
merged = con.execute("SELECT COUNT(*) FROM tbl_brz_gh_pull "
                     "WHERE json_extract(payload,'$.merged_at') IS NOT NULL").fetchone()[0]
print(f"  pull requests     : {n_pr}, merged {merged}")
states = collections.Counter(); rev_bot = rev_hum = 0
for (p,) in con.execute("SELECT payload FROM tbl_brz_gh_review"):
    d = json.loads(p); states[d.get("state")] += 1
    u = (d.get("user") or {}).get("login", "")
    rev_bot, rev_hum = (rev_bot + 1, rev_hum) if "[bot]" in u else (rev_bot, rev_hum + 1)
print(f"  reviews           : {sum(states.values())}  (human {rev_hum}, bot {rev_bot})")
print("    " + ", ".join(f"{k} {v}" for k, v in states.most_common()))
c_bot = c_hum = 0; lens = []
for (p,) in con.execute("SELECT payload FROM tbl_brz_gh_review_comment"):
    d = json.loads(p); u = (d.get("user") or {}).get("login", "")
    if "[bot]" in u:
        c_bot += 1
    else:
        c_hum += 1; lens.append(len(d.get("body") or ""))
print(f"  review comments   : {c_hum + c_bot}  (human {c_hum}, bot {c_bot})")
if lens:
    print(f"    human comment length: median {int(statistics.median(lens))} characters")

# %% --- 5. issues ---
rule("5. Jira issues and comments")
comp = collections.Counter(); typ = collections.Counter(); status = collections.Counter(); dlen = []
issue_keys = set()
for k, p in con.execute("SELECT issue_key, payload FROM tbl_brz_ji_issue"):
    issue_keys.add(k)
    f = json.loads(p).get("fields", {})
    for c in f.get("components") or []:
        comp[c.get("name", "?")] += 1
    typ[(f.get("issuetype") or {}).get("name", "?")] += 1
    status[(f.get("status") or {}).get("name", "?")] += 1
    dlen.append(len(f.get("description") or ""))
print(f"  issues            : {len(issue_keys)}")
print(f"  comments          : {db.count(con, 'tbl_brz_ji_comment')}")
print(f"  description length: median {int(statistics.median(dlen))} characters, "
      f"empty {sum(1 for x in dlen if x == 0)}")
print("  types             : " + ", ".join(f"{k} {v}" for k, v in typ.most_common(5)))
print("  components (top 8): " + ", ".join(f"{k} {v}" for k, v in comp.most_common(8)))

# %% --- 6. how well does it join ---
rule("6. Join quality")
linked = nokey = unresolved = 0
for (s,) in con.execute("SELECT subject FROM tbl_brz_gh_commit"):
    m = re.search(rf"{key_prefix}-\d+", s or "")
    if not m:
        nokey += 1
    elif m.group(0) in issue_keys:
        linked += 1
    else:
        unresolved += 1
print(f"  commit -> issue   : {linked} linked, {unresolved} key without issue, {nokey} without key")
print(f"                      {100*linked//(linked+unresolved+nokey)} % of all commits")
pr_refs = set()
for (s_,) in con.execute("SELECT subject FROM tbl_brz_gh_commit"):
    m = re.search(r"#(\d+)", s_ or "")
    if m:
        pr_refs.add(m.group(1))
pr_loaded = {str(r[0]) for r in con.execute("SELECT pr_number FROM tbl_brz_gh_pull")}
print(f"  commit -> PR      : {len(pr_refs & pr_loaded)} of {len(pr_refs)} "
      f"referenced pull requests are loaded")

con.close()
print("\nTo browse the data: open pipeline/data/bronze/bronze.sqlite in a database tool.")
