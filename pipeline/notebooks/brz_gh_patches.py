# Databricks notebook source
# %% [markdown]
# # BRZ — code changes per commit
# Stores the added lines per changed file, capped per file. Generated files,
# translation bundles and binaries are skipped: they carry no competence signal.
# Requires a clone with file contents (shallow_since in params.yaml).

# %%
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd().parent / "src"))
from devskill.config import Config
from devskill import db, git_ingest

cfg = Config()
print(cfg)

# %%
repo = git_ingest.clone_or_update(cfg.project["repo_url"], cfg.repo_path,
                                  cfg.project.get("shallow_since"))
print("clone:", repo)

# %%
con = db.connect(cfg.path("sqlite_bronze"))
db.run_script(con, Path.cwd().parent / "sql" / "00_bronze.sql")
before = db.count(con, "brz_gh_commit_patch")
print("already stored:", before)

# %%
n = 0
for sha, path, added, n_add, n_del, truncated in git_ingest.read_patches(
        repo, cfg.window["start"], cfg.window["end"]):
    db.upsert(con, "brz_gh_commit_patch", {
        "sha": sha, "file_path": path, "fetched_at": db.now(),
        "n_added": n_add, "n_removed": n_del, "is_truncated": truncated,
        "added_lines": added})
    n += 1
    if n % 2000 == 0:
        con.commit(); print(f"  {n} files ...", flush=True)
con.commit()
db.log_fetch(con, "git_patches", {"window": cfg.window}, n)

rows = db.count(con, "brz_gh_commit_patch")
shas = con.execute("SELECT COUNT(DISTINCT sha) FROM brz_gh_commit_patch").fetchone()[0]
chars = con.execute("SELECT SUM(LENGTH(added_lines)) FROM brz_gh_commit_patch").fetchone()[0] or 0
print(f"stored: {rows} files across {shas} commits, {chars/1e6:.1f} MB of code text")

# %% [markdown]
# ## Quick check: which file types carry the code?

# %%
import collections, re
ext = collections.Counter()
for (p,) in con.execute("SELECT file_path FROM brz_gh_commit_patch"):
    m = re.search(r"\.([A-Za-z0-9]+)$", p)
    ext[m.group(1).lower() if m else "(none)"] += 1
for k, v in ext.most_common(15):
    print(f"{v:7d}  .{k}")
con.close()
