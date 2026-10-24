# Databricks notebook source
# %% [markdown]
# # BRZ — commits from the local git clone
# Reads every commit in the observation window and stores it unchanged in bronze.
# No GitHub API access and no token required.

# %%
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path.cwd().parent / "src"))
from devskill.config import Config
from devskill import db, git_ingest

cfg = Config()
print(cfg)

# %%
repo = git_ingest.clone_or_update(cfg.project["repo_url"], cfg.repo_path)
print("clone:", repo)
print("HEAD: ", git_ingest.head_sha(repo))

# %%
con = db.connect(cfg.path("sqlite_bronze"))
db.run_script(con, Path.cwd().parent / "sql" / "00_bronze.sql")
known = db.existing_ids(con, "brz_gh_commit", "sha")
print("already loaded:", len(known))

# %%
n = 0
for c in git_ingest.read_commits(repo, cfg.window["start"], cfg.window["end"]):
    if c["sha"] in known:
        continue
    db.upsert(con, "brz_gh_commit", {
        "sha": c["sha"], "fetched_at": db.now(), "authored_at": c["authored_at"],
        "author_name": c["author_name"], "author_email": c["author_email"],
        "subject": c["subject"], "payload": json.dumps(c, ensure_ascii=False)})
    n += 1
    if n % 500 == 0:
        con.commit(); print(f"  {n} ...")
con.commit()
db.log_fetch(con, "git_commits", {"window": cfg.window, "head": git_ingest.head_sha(repo)}, n)
print(f"newly loaded: {n} | total in bronze: {db.count(con, 'brz_gh_commit')}")

# %% [markdown]
# ## Quick check: how complete are issue keys and pull request numbers?

# %%
import re
rows = con.execute("SELECT subject FROM brz_gh_commit").fetchall()
key = cfg.project["jira_project_key"]
with_key = sum(1 for (s,) in rows if re.search(rf"{key}-\d+", s or ""))
with_pr = sum(1 for (s,) in rows if re.search(r"#\d+", s or ""))
print(f"{len(rows)} commits | with {key} key: {with_key} "
      f"({100*with_key//max(len(rows),1)}%) | with PR number: {with_pr} "
      f"({100*with_pr//max(len(rows),1)}%)")
con.close()
