# Databricks notebook source
# %% [markdown]
# # BRZ — Jira issues with comments and changelog
# Anonymous read access, no token. Stops with an explicit message if the instance
# does not allow anonymous access.

# %%
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path.cwd().parent / "src"))
from devskill.config import Config
from devskill import db
from devskill.jira_ingest import Jira

cfg = Config()
ji = Jira(cfg.project["jira_base"], cfg.jira.get("pause_seconds", 0.3))
pkey = cfg.project["jira_project_key"]
print(cfg, "|", cfg.project["jira_base"], pkey)

# %%
con = db.connect(cfg.path("sqlite_bronze"))
db.run_script(con, Path.cwd().parent / "sql" / "00_bronze.sql")
known = db.existing_ids(con, "brz_ji_issue", "issue_key")
print("already loaded:", len(known))

# %%
keys = list(ji.issue_keys(pkey, cfg.window["start"], cfg.window["end"]))
print(f"{len(keys)} issues created inside the window")

# Commits in the window often reference older issues: a bug reported in 2023 may
# be fixed in 2025. Those issues are needed for the join, so collect the keys
# referenced by commits and add whatever the window missed.
import re
referenced = set()
for (subject,) in con.execute("SELECT subject FROM brz_gh_commit"):
    m = re.search(rf"{pkey}-\d+", subject or "")
    if m:
        referenced.add(m.group(0))
extra = sorted(referenced - set(keys))
print(f"{len(referenced)} issues referenced by commits, "
      f"{len(extra)} of them outside the window and added")
keys = keys + extra

# %%
n_i = n_c = 0
for i, k in enumerate(keys, 1):
    if k in known:
        continue
    d = ji.issue(k)
    if not d:
        continue
    f = d.get("fields", {})
    db.upsert(con, "brz_ji_issue", {
        "issue_key": d.get("key", k), "fetched_at": db.now(),
        "created_at": (f.get("created") or "")[:19],
        "updated_at": (f.get("updated") or "")[:19],
        "payload": json.dumps(d, ensure_ascii=False)})
    n_i += 1
    for c in (f.get("comment") or {}).get("comments", []) or []:
        db.upsert(con, "brz_ji_comment", {
            "comment_id": f"{k}:{c.get('id')}", "issue_key": k,
            "fetched_at": db.now(), "payload": json.dumps(c, ensure_ascii=False)})
        n_c += 1
    if n_i % 50 == 0:
        con.commit(); print(f"  {i}/{len(keys)} ...", flush=True)

con.commit()
db.log_fetch(con, "jira_issues", {"window": cfg.window, "project": pkey}, n_i)
print(f"new: {n_i} issues, {n_c} comments")
print("totals:", db.count(con, "brz_ji_issue"), db.count(con, "brz_ji_comment"))

# %% [markdown]
# ## Quick check: which fields are actually populated?

# %%
import collections
filled = collections.Counter()
for (p,) in con.execute("SELECT payload FROM brz_ji_issue LIMIT 300"):
    for k, v in json.loads(p).get("fields", {}).items():
        if v not in (None, [], "", {}):
            filled[k] += 1
for k, v in filled.most_common(40):
    print(f"{v:5d}  {k}")
con.close()
