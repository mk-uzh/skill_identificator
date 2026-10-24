# Databricks notebook source
# %% [markdown]
# # BRZ — preview of the bronze layer (pseudonymised)
# Shows the loaded tables and sample data. People appear only as DEV-01, DEV-02, ...
# The mapping to real names is written locally to pipeline/data/mapping.secrets.json
# and must not be versioned. No CSV export: the data lives in the SQLite database
# and is inspected there.

# %%
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path.cwd().parent / "src"))
from devskill.config import Config, PIPELINE_ROOT
from devskill import db
from devskill.identity import build, write_mapping

cfg = Config()
con = db.connect(cfg.path("sqlite_bronze"))

# %% --- tables and row counts ---
tables = [r[0] for r in con.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'brz_%' ORDER BY name")]
print(f"{'table':28}{'rows':>10}")
print("-" * 38)
for t in tables:
    print(f"{t:28}{db.count(con, t):>10}")

# %% --- merge identities and pseudonymise ---
pairs = con.execute("SELECT author_name, author_email FROM brz_gh_commit").fetchall()
mapping, people = build(pairs, PIPELINE_ROOT)
path = write_mapping(people, PIPELINE_ROOT / "data" / "mapping.secrets.json")

threshold = cfg.scope.get("min_commits", 10)
in_scope = [p for p in people.values() if p["n_commits"] >= threshold and not p["is_bot"]]
print(f"\n{len(people)} people after merging "
      f"({sum(1 for p in people.values() if p['is_bot'])} of them bots)")
print(f"with at least {threshold} commits and not a bot: {len(in_scope)}")
print(f"mapping stored locally: {path}")


def dev(name, email):
    return mapping.get(((name or "").lower(), (email or "").lower()), "DEV-??")


# %% --- contributions per person, without real names ---
print(f"\n{'dev_id':9}{'commits':>9}  {'hash':18}{'identities':>11}  bot")
print("-" * 58)
for p in sorted(people.values(), key=lambda x: -x["n_commits"])[:20]:
    print(f"{p['dev_id']:9}{p['n_commits']:>9}  {p['dev_hash']:18}"
          f"{len(p['names']):>11}  {'yes' if p['is_bot'] else ''}")

# %% --- the most recent commits ---
print("\nTen most recent commits\n" + "-" * 76)
for ts, n, e, subject in con.execute(
        "SELECT authored_at, author_name, author_email, subject FROM brz_gh_commit "
        "ORDER BY authored_at DESC LIMIT 10"):
    print(f"{ts[:10]}  {dev(n, e):9} {subject[:58]}")

# %% --- one full record, without personal details ---
(payload,) = con.execute(
    "SELECT payload FROM brz_gh_commit ORDER BY authored_at DESC LIMIT 1").fetchone()
c = json.loads(payload)
print("\nOne complete commit record\n" + "-" * 76)
for k, v in c.items():
    if k in ("author_name", "author_email", "committer_name", "committer_email"):
        continue
    if k == "files":
        print(f"{k:16}: {len(v)} files")
        for f in v[:5]:
            print(f"{'':18}{f['change_type']}  {f['path']}")
    elif k == "body":
        print(f"{k:16}: {(v[:120] + ' ...') if len(v) > 120 else v!r}")
    else:
        print(f"{k:16}: {v}")
print(f"{'dev_id':16}: {dev(c['author_name'], c['author_email'])}")

# %%
con.close()
print("\nDone. To browse the data, open pipeline/data/bronze/bronze.sqlite in a "
      "database tool.")
