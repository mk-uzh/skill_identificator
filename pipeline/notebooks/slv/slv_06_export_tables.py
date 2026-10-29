"""Export the silver tables of one project as CSV for sharing (pseudonymised, scrubbed).

Run:  DEVSKILL_PROJECT=nifi python pipeline/notebooks/slv/slv_06_export_tables.py
Writes docs/silver/<project>/<table>.csv, one file per silver table (versioned, unlike pipeline/data/).
The evidence units have their own export, slv_05_export_units.py, and are not repeated here.

What changes on the way out:
  * columns ending in _hash are dropped (salted hashes of accounts and logins; dev_id stays)
  * e-mail addresses, @handles, Jira mentions [~name], Co-authored-by style trailers are removed
  * real names from mapping.secrets.json -> [name]   (the mapping itself is never exported)
  * GitHub profile URLs -> github.com/[user]
  * added code lines keep their @ (annotations), only e-mail addresses and names are replaced
Not caught: names in free text that are not in the mapping. The result is pseudonymised, not anonymous.
"""
import csv, json, re, shutil, sqlite3, sys, tempfile
from pathlib import Path

csv.field_size_limit(sys.maxsize)
ROOT = next(p for p in [Path(__file__).resolve(), *Path(__file__).resolve().parents] if (p / "src" / "devskill").exists())
sys.path.insert(0, str(ROOT / "src"))
from devskill.config import Config

cfg = Config()
name = cfg.project["name"]
db = cfg.path("sqlite_silver")
OUT = ROOT.parent / "docs" / "silver" / name
OUT.mkdir(parents=True, exist_ok=True)
SKIP = {"tbl_slv_evidence_unit", "tbl_slv_build_log"}
CODE_COLS = {"added_lines"}

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
HANDLE = re.compile(r"(?<![\w/])@[A-Za-z0-9][\w.-]{1,38}")
TRAILER = re.compile(r"(?im)^\s*(co-authored-by|signed-off-by|reviewed-by|reported-by|suggested-by)\s*:.*\n?")
own = re.escape(cfg.project["github_owner"])
PROFILE = re.compile(rf"github\.com/(?!{own}\b)[A-Za-z0-9-]+(?=[\s)/\]]|$)")
JIRA = re.compile(r"\[~[^\]]+\]")

names = set()
def walk(o):
    if isinstance(o, dict): [walk(v) for v in o.values()]
    elif isinstance(o, list): [walk(v) for v in o]
    elif isinstance(o, str) and " " in o and "@" not in o and len(o) > 5 and not o.startswith(("DEV", "http")): names.add(o)
mp = cfg.data_root / "mapping.secrets.json"
if mp.exists(): walk(json.loads(mp.read_text(encoding="utf-8")))
name_re = re.compile("|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))) if names else None

def scrub(t, code=False):
    if not t or not isinstance(t, str): return t
    t = TRAILER.sub("", t); t = EMAIL.sub("[email]", t)
    if not code: t = HANDLE.sub("[user]", t); t = JIRA.sub("[user]", t); t = PROFILE.sub("github.com/[user]", t)
    if name_re: t = name_re.sub("[name]", t)
    return t

def open_db():
    try:
        c = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True); c.execute("SELECT 1 FROM tbl_slv_developer LIMIT 1"); return c
    except sqlite3.OperationalError:      # read-only mount without WAL support: work on a copy, original untouched
        tmp = Path(tempfile.mkdtemp()); [shutil.copy(str(db) + s, tmp / (db.name + s)) for s in ("", "-wal", "-shm") if Path(str(db) + s).exists()]
        return sqlite3.connect(tmp / db.name)

con = open_db()
tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'tbl_slv_%' ORDER BY name")]
for t in tables:
    if t in SKIP: continue
    cols = [r[1] for r in con.execute(f"PRAGMA table_info({t})")]
    keep = [c for c in cols if not c.endswith("_hash")]
    pk = [r[1] for r in sorted(con.execute(f"PRAGMA table_info({t})"), key=lambda r: r[5]) if r[5] > 0] or [keep[0]]
    rows = con.execute(f"SELECT {', '.join(keep)} FROM {t} ORDER BY {', '.join(pk)}").fetchall()
    out = OUT / (t.replace("tbl_", "") + ".csv")
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh); w.writerow(keep)
        for r in rows:
            w.writerow([scrub(v, code=c in CODE_COLS) if isinstance(v, str) and c not in ("sha", "file_path", "issue_key", "dev_id") else v for c, v in zip(keep, r)])
    print(f"{name}: {t:28s} {len(rows):6d} rows -> {out.name} ({out.stat().st_size/1e6:.1f} MB)", flush=True)
