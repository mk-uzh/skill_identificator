# Databricks notebook source
# %% [markdown]
# # BRZ — pull requests, reviews and review comments
# Uses the GitHub REST API. Put a token into .env as GITHUB_TOKEN, otherwise only
# 60 requests per hour are allowed. The run is resumable: pull requests already
# stored are skipped.

# %%
import sys, json, os
from pathlib import Path
sys.path.insert(0, str(Path.cwd().parent / "src"))
from devskill.config import Config
from devskill import db
from devskill.github_ingest import GitHub

try:
    from dotenv import load_dotenv; load_dotenv(Path.cwd().parent.parent / ".env")
except ImportError:
    pass

cfg = Config()
gh = GitHub(cfg.github_token)
owner, repo = cfg.project["github_owner"], cfg.project["github_repo"]
print(cfg, "| token present:", bool(cfg.github_token))

# %%
con = db.connect(cfg.path("sqlite_bronze"))
db.run_script(con, Path.cwd().parent / "sql" / "00_bronze.sql")
known = db.existing_ids(con, "brz_gh_pull", "pr_number")
print("already loaded:", len(known))

# %%
start, end = cfg.window["start"], cfg.window["end"]
n_pr = n_rev = n_com = 0

for pr in gh.pulls(owner, repo, cfg.github.get("pulls_state", "all")):
    created = (pr.get("created_at") or "")[:10]
    if created and created < start:
        break                      # the listing is sorted descending
    if created and created > end:
        continue
    num = pr["number"]
    if num in known:
        continue

    db.upsert(con, "brz_gh_pull", {
        "pr_number": num, "fetched_at": db.now(), "state": pr.get("state"),
        "merged_at": pr.get("merged_at"), "payload": json.dumps(pr, ensure_ascii=False)})
    n_pr += 1

    for rv in gh.reviews(owner, repo, num):
        db.upsert(con, "brz_gh_review", {
            "review_id": rv["id"], "pr_number": num, "fetched_at": db.now(),
            "payload": json.dumps(rv, ensure_ascii=False)})
        n_rev += 1

    for rc in gh.review_comments(owner, repo, num):
        db.upsert(con, "brz_gh_review_comment", {
            "comment_id": rc["id"], "pr_number": num, "fetched_at": db.now(),
            "payload": json.dumps(rc, ensure_ascii=False)})
        n_com += 1

    if n_pr % 25 == 0:
        con.commit(); print(f"  {n_pr} pull requests ...", flush=True)

con.commit()
db.log_fetch(con, "github_pulls", {"window": cfg.window}, n_pr)
print(f"new: {n_pr} pull requests, {n_rev} reviews, {n_com} review comments")
print("totals:", db.count(con, "brz_gh_pull"), db.count(con, "brz_gh_review"),
      db.count(con, "brz_gh_review_comment"))
con.close()
