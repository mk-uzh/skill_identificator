"""One-off migration: rename the bronze tables to the tbl_brz_ naming scheme.

Run once on an existing bronze.sqlite. Safe to run again: tables already
renamed are skipped. No data is reloaded.
"""
import sys
from pathlib import Path
ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents]
            if (p / "src" / "devskill").exists())
sys.path.insert(0, str(ROOT / "src"))
from devskill.config import Config
from devskill import db

NAMES = ["brz_fetch_log", "brz_gh_commit", "brz_gh_commit_patch", "brz_gh_pull",
         "brz_gh_review", "brz_gh_review_comment", "brz_ji_issue", "brz_ji_comment"]

cfg = Config()
con = db.connect(cfg.path("sqlite_bronze"))
existing = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}

for n in NAMES:
    if n in existing and f"tbl_{n}" not in existing:
        con.execute(f"ALTER TABLE {n} RENAME TO tbl_{n}")
        print(f"  renamed {n} -> tbl_{n}")
    elif f"tbl_{n}" in existing:
        print(f"  already renamed: tbl_{n}")
    else:
        print(f"  not present: {n}")

# old indexes follow the table automatically; drop the stale names if any remain
for (idx,) in list(con.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'ix_brz_%'")):
    con.execute(f"DROP INDEX IF EXISTS {idx}")
con.commit()

print("\nTables now in the database:")
for (t,) in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
    print(f"  {t:28}{db.count(con, t):>9}")
con.close()
