"""Export the evidence units of one project as CSV for sharing (pseudonymised, scrubbed).

Run from anywhere:  DEVSKILL_PROJECT=nifi py pipeline/notebooks/slv/slv_05_export_units.py
Writes docs/evidence/<project>_evidence_units.csv (versioned, unlike pipeline/data/).

Scrubbing, on top of what slv_03 already removes (e-mail addresses, @handles):
  * Jira mentions [~username]            -> [user]
  * real names from mapping.secrets.json -> [name]   (mapping itself is never exported)
  * GitHub profile URLs                  -> github.com/[user]
  * Co-authored-by / Signed-off-by lines are dropped
Not caught: names in free text that are not in the mapping. The result is pseudonymised, not anonymous.
Dropped columns: dev_hash and built_at (not part of the unit).
"""
import csv, json, re, sqlite3, sys
from pathlib import Path

ROOT = next(p for p in [Path(__file__).resolve(), *Path(__file__).resolve().parents] if (p / "src" / "devskill").exists())
sys.path.insert(0, str(ROOT / "src"))
from devskill.config import Config

cfg = Config()
name = cfg.project["name"]
db = cfg.path("sqlite_silver")
OUT = ROOT.parent / "docs" / "evidence"; OUT.mkdir(parents=True, exist_ok=True)

names = set()
def walk(o):
    if isinstance(o, dict): [walk(v) for v in o.values()]
    elif isinstance(o, list): [walk(v) for v in o]
    elif isinstance(o, str) and " " in o and "@" not in o and len(o) > 5 and not o.startswith(("DEV", "http")): names.add(o)
mp = cfg.data_root / "mapping.secrets.json"
if mp.exists(): walk(json.loads(mp.read_text(encoding="utf-8")))
name_re = re.compile("|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))) if names else None
own = re.escape(cfg.project["github_owner"])
subs = [(re.compile(r"\[~[^\]]+\]"), "[user]"),
        (re.compile(rf"github\.com/(?!{own}\b)[A-Za-z0-9-]+(?=[\s)/\]]|$)"), "github.com/[user]"),
        (re.compile(r"(?im)^.*(co-authored-by|signed-off-by|reviewed-by):.*\n?"), "")]
def scrub(t):
    n = 0
    for rx, rep in subs: t, k = rx.subn(rep, t); n += k
    if name_re: t, k = name_re.subn("[name]", t); n += k
    return t, n

def open_db():
    try:
        c = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True); c.execute("SELECT 1 FROM tbl_slv_evidence_unit LIMIT 1"); return c
    except sqlite3.OperationalError:      # read-only mount without WAL support: work on a copy, original untouched
        import shutil, tempfile
        tmp = Path(tempfile.mkdtemp()); [shutil.copy(str(db) + s, tmp / (db.name + s)) for s in ("", "-wal", "-shm") if Path(str(db) + s).exists()]
        return sqlite3.connect(tmp / db.name)
con = open_db()
rows = con.execute("SELECT evidence_id, dev_id, role, issue_key, n_commits, n_files, n_chars, has_code, has_review, text_blob "
                   "FROM tbl_slv_evidence_unit ORDER BY dev_id, issue_key, role").fetchall()
out = OUT / f"{name}_evidence_units.csv"; changed = total = 0
with out.open("w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["evidence_id", "project", "dev_id", "role", "issue_key", "n_commits", "n_files", "n_chars", "has_code", "has_review", "text"])
    for r in rows:
        t, n = scrub(r[9] or ""); total += n; changed += n > 0
        w.writerow([r[0], name, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], t])
print(f"{name}: {len(rows)} units -> {out} ({out.stat().st_size/1e6:.1f} MB); scrubbed {total} spots in {changed} units")
