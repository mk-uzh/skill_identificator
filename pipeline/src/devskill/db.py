"""Thin SQLite helper. Bronze stores raw payloads unchanged as JSON text."""
from __future__ import annotations
import json, sqlite3
from pathlib import Path
from datetime import datetime, timezone


def connect(path: str | Path) -> sqlite3.Connection:
    con = sqlite3.connect(str(path))
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def run_script(con: sqlite3.Connection, sql_file: str | Path) -> None:
    with open(sql_file, encoding="utf-8") as f:
        con.executescript(f.read())
    con.commit()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def upsert(con: sqlite3.Connection, table: str, row: dict) -> None:
    cols = ",".join(row)
    ph = ",".join("?" for _ in row)
    con.execute(f"INSERT OR REPLACE INTO {table} ({cols}) VALUES ({ph})",
                [json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v
                 for v in row.values()])


def existing_ids(con: sqlite3.Connection, table: str, col: str) -> set:
    try:
        return {r[0] for r in con.execute(f"SELECT {col} FROM {table}")}
    except sqlite3.OperationalError:
        return set()


def log_fetch(con: sqlite3.Connection, source: str, params: dict, n_items: int) -> None:
    upsert(con, "tbl_brz_fetch_log", {
        "source": source, "fetched_at": now(),
        "params": json.dumps(params, ensure_ascii=False), "n_items": n_items})
    con.commit()


def count(con: sqlite3.Connection, table: str) -> int:
    return con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
