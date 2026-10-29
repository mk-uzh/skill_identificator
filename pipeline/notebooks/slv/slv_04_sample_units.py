"""
Draw a reproducible sample of evidence units for manual coding.

Why a script and not a hand-picked selection: the sample that gets coded by
hand becomes the gold standard the classifier is measured against. If nobody
can say which units were in it, the agreement figure means nothing. So the
draw is seeded, the drawn ids are written next to the readable export, and
re-running with the same seed produces the same sample.

The draw is stratified by role, proportional to how often each role occurs.
Nothing else is filtered: thin units stay in, because how many units are too
thin to judge is itself a finding, and removing them before coding would hide
it.

Usage:
    py pipeline/notebooks/slv/slv_04_sample_units.py                # 20 units
    py pipeline/notebooks/slv/slv_04_sample_units.py --n 120        # full set
    py pipeline/notebooks/slv/slv_04_sample_units.py --n 120 --seed 7

Writes into pipeline/data/<project>/silver/samples/:
    sample_n<N>_seed<S>.md    readable, one unit per section
    sample_n<N>_seed<S>.csv   the drawn ids, for the record
"""

import argparse
import csv
import random
import sqlite3
from pathlib import Path

THIN_CHARS = 400  # below this a unit is unlikely to support any judgement


def _pipeline_root() -> Path:
    """Locate pipeline/ from this file, so the script runs from anywhere."""
    here = Path(__file__).resolve()
    for candidate in (here.parent, *here.parents):
        if (candidate / "src" / "devskill").exists():
            return candidate
    for candidate in (Path.cwd(), *Path.cwd().parents):
        if (candidate / "src" / "devskill").exists():
            return candidate
    raise SystemExit("Could not find pipeline/. Run this from inside the repository.")


ROOT = _pipeline_root()
import sys as _sys
_sys.path.insert(0, str(ROOT / "src"))
from devskill.config import Config as _Config
DB = _Config().path("sqlite_silver")
OUT_DIR = DB.parent / "samples"

COLUMNS = """
    evidence_id, dev_id, role, issue_key, n_commits, n_files,
    n_chars, has_code, has_review, text_blob
"""


def describe(rows) -> None:
    """Print what is in the table before anything is drawn."""
    by_role: dict[str, int] = {}
    by_dev: dict[str, dict[str, int]] = {}
    thin = 0
    for r in rows:
        by_role[r["role"]] = by_role.get(r["role"], 0) + 1
        slot = by_dev.setdefault(r["dev_id"], {"author": 0, "reviewer": 0})
        slot[r["role"]] = slot.get(r["role"], 0) + 1
        if (r["n_chars"] or 0) < THIN_CHARS:
            thin += 1

    print(f"{len(rows)} units in the table")
    print(f"  by role: {by_role}")
    print(f"  under {THIN_CHARS} characters: {thin} "
          f"({thin / max(len(rows), 1):.0%}) — too thin to judge")
    print("  per person (author / reviewer):")
    for dev in sorted(by_dev):
        c = by_dev[dev]
        print(f"    {dev:<10} {c['author']:>5} / {c['reviewer']:>5}")


def draw(rows, n: int, seed: int):
    """Stratified by role, proportional, deterministic for a given seed."""
    buckets: dict[str, list] = {}
    for r in rows:
        buckets.setdefault(r["role"], []).append(r)

    total = len(rows)
    picked = []
    rng = random.Random(seed)
    for role in sorted(buckets):
        pool = sorted(buckets[role], key=lambda r: r["evidence_id"])
        share = max(1, round(n * len(pool) / total))
        share = min(share, len(pool))
        picked.extend(rng.sample(pool, share))

    # Proportional rounding can overshoot or undershoot by one or two.
    picked.sort(key=lambda r: r["evidence_id"])
    rng.shuffle(picked)
    return picked[:n]


def write_markdown(path: Path, picked, n: int, seed: int) -> None:
    lines = [
        f"# Evidence units for manual coding (n={len(picked)}, seed={seed})",
        "",
        "Read one unit, write down in your own words what this person can do.",
        "Do not consult a competence list yet — that comes after all units are",
        "coded. Note it when a unit does not let you judge anything; that is a",
        "result, not a failure.",
        "",
    ]
    for i, r in enumerate(picked, 1):
        lines += [
            "---",
            "",
            f"## {i}. {r['evidence_id']}",
            "",
            f"- person: `{r['dev_id']}`  role: **{r['role']}**  "
            f"issue: `{r['issue_key']}`",
            f"- {r['n_commits']} commits, {r['n_files']} files, "
            f"{r['n_chars']} characters, "
            f"code: {'yes' if r['has_code'] else 'no'}, "
            f"review: {'yes' if r['has_review'] else 'no'}",
            "",
            "```text",
            (r["text_blob"] or "").strip(),
            "```",
            "",
            "**What this person can do:**",
            "",
            "**Not judgeable because:**",
            "",
        ]
    path.write_text("\n".join(lines), encoding="utf-8")


def write_ids(path: Path, picked) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["evidence_id", "dev_id", "role", "issue_key", "n_chars"])
        for r in picked:
            w.writerow([r["evidence_id"], r["dev_id"], r["role"],
                        r["issue_key"], r["n_chars"]])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20, help="how many units to draw")
    ap.add_argument("--seed", type=int, default=42, help="keep this in the thesis")
    args = ap.parse_args()

    if not DB.exists():
        raise SystemExit(f"Silver database not found: {DB}")

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    rows = con.execute(f"SELECT {COLUMNS} FROM tbl_slv_evidence_unit "
                       "ORDER BY evidence_id").fetchall()
    con.close()

    if not rows:
        raise SystemExit("tbl_slv_evidence_unit is empty — run slv_03 first.")

    describe(rows)

    picked = draw(rows, args.n, args.seed)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stem = f"sample_n{len(picked)}_seed{args.seed}"
    md, ids = OUT_DIR / f"{stem}.md", OUT_DIR / f"{stem}.csv"
    write_markdown(md, picked, args.n, args.seed)
    write_ids(ids, picked)

    print()
    print(f"drew {len(picked)} units (seed {args.seed})")
    print(f"  {md}")
    print(f"  {ids}")


if __name__ == "__main__":
    main()
