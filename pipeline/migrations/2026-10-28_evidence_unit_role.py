"""
Add 'role' to tbl_slv_evidence_unit.

A person takes part in an issue in one of two ways: they write the code, or
they inspect somebody else's. The level scale treats those differently —
inspecting other people's work is what separates level 4 from level 3 — so the
two cannot share a row. The column defaults to 'author', which is what every
row written before this migration was.

Run once:  python 2026-10-28_evidence_unit_role.py
"""

import sqlite3
from pathlib import Path

def _pipeline_root() -> Path:
    """
    Locate pipeline/ from THIS FILE, not from the working directory.

    The older notebooks search upwards from the current directory, which only
    works because PyCharm changes into the script's folder before running it.
    Called from the repository root, or from PowerShell, that search finds
    nothing. Starting at __file__ makes the script run the same way from
    anywhere; the working directory is only a fallback.
    """
    here = Path(__file__).resolve()
    for candidate in (here.parent, *here.parents):
        if (candidate / "src" / "devskill").exists():
            return candidate
    for candidate in (Path.cwd(), *Path.cwd().parents):
        if (candidate / "src" / "devskill").exists():
            return candidate
    raise SystemExit(
        "Could not find the pipeline/ directory. "
        "Run this script from inside the repository."
    )


ROOT = _pipeline_root()
DB = ROOT / "data" / "silver" / "silver.sqlite"


def main() -> None:
    if not DB.exists():
        raise SystemExit(f"Silver database not found: {DB}")
    con = sqlite3.connect(DB)
    cols = {r[1] for r in con.execute("PRAGMA table_info(tbl_slv_evidence_unit)")}
    if not cols:
        raise SystemExit("tbl_slv_evidence_unit does not exist — run sql/01_silver.sql first.")
    if "role" in cols:
        print("Already migrated: 'role' is present.")
        return
    con.execute(
        "ALTER TABLE tbl_slv_evidence_unit ADD COLUMN role TEXT NOT NULL DEFAULT 'author'"
    )
    con.commit()
    print("Added column 'role' (default 'author').")
    con.close()


if __name__ == "__main__":
    main()
