"""
Evidence units: one per developer, role and issue.

An evidence unit is the smallest piece of work that can be judged on its own:
one person, one tracker issue, everything they did in it, gathered into one
text block. A single commit without that context says too little; a whole
person says too much.

A person can be involved in two ways, and the difference matters for the
level scale: they either wrote the code (role "author") or they inspected
somebody else's (role "reviewer"). Reviewing is the evidence the upper levels
rest on, so it gets units of its own rather than disappearing into a flag.

The text block is what the classification will read. Identities in Silver are
already pseudonymous, but free text is not: commit messages and comments carry
@handles and mail addresses. Those are replaced here, before the text can ever
reach a model.

Run:  python slv_03_evidence_units.py
"""

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
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

# A unit has to stay readable for a model and comparable to the others.
MAX_CHARS = 12_000
MAX_CODE_CHARS = 4_000
MAX_BODY_CHARS = 1_500

HANDLE = re.compile(r"(?<![\w/])@[A-Za-z0-9][\w.-]{1,38}")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# Commit trailers naming people; the author is already known from dev_id.
TRAILER = re.compile(
    r"^\s*(Co-authored-by|Signed-off-by|Reviewed-by|Reported-by|Suggested-by)\s*:.*$",
    re.IGNORECASE | re.MULTILINE,
)


def scrub(text: str | None) -> str:
    """Remove names that pseudonymisation of the identity columns does not catch."""
    if not text:
        return ""
    text = TRAILER.sub("[trailer removed]", text)
    text = EMAIL.sub("[email]", text)
    text = HANDLE.sub("[user]", text)
    return text.strip()


def scrub_code(text: str | None) -> str:
    """
    Like scrub, but leaves @ alone.

    Source code is full of @: Java annotations (@Test, @Override), Python
    decorators, docblock tags. Treating those as handles turns working code
    into nonsense, and the classification would then judge mangled evidence.
    Code carries no @handles anyway; what it can carry is a mail address in a
    licence header, so that is still removed.
    """
    if not text:
        return ""
    return EMAIL.sub("[email]", text).strip()


def clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + f"\n[... {len(text) - limit} characters omitted]"


def section(title: str, body: str) -> str:
    body = body.strip()
    return f"## {title}\n{body}\n\n" if body else ""


def ensure_schema(con: sqlite3.Connection) -> None:
    cols = {r[1] for r in con.execute("PRAGMA table_info(tbl_slv_evidence_unit)")}
    if not cols:
        raise SystemExit("tbl_slv_evidence_unit is missing — run sql/01_silver.sql first.")
    if "role" not in cols:
        raise SystemExit(
            "tbl_slv_evidence_unit has no 'role' column.\n"
            "Run: python ../../migrations/2026-10-28_evidence_unit_role.py"
        )


def issue_header(con: sqlite3.Connection, issue_key: str) -> str:
    row = con.execute(
        """SELECT issue_type, status, resolution, priority, summary, description
           FROM tbl_slv_issue WHERE issue_key = ?""",
        (issue_key,),
    ).fetchone()
    if not row:
        return f"Issue {issue_key}: not in the tracker export.\n\n"
    issue_type, status, resolution, priority, summary, description = row
    # The component column has had different names across schema versions.
    col = _component_column(con)
    components = (
        [
            r[0]
            for r in con.execute(
                f"SELECT {col} FROM tbl_slv_issue_component WHERE issue_key = ?", (issue_key,)
            )
            if r[0]
        ]
        if col
        else []
    )
    head = (
        f"Issue {issue_key} ({issue_type or 'unknown type'}, {status or 'unknown status'}"
        f"{', ' + resolution if resolution else ''}"
        f"{', priority ' + priority if priority else ''})\n"
        f"Title: {scrub(summary)}\n"
    )
    if components:
        head += f"Area: {', '.join(components)}\n"
    return section("The task", head + "\n" + clip(scrub(description), MAX_BODY_CHARS))


def _has_table(con: sqlite3.Connection, name: str) -> bool:
    return con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


def _component_column(con: sqlite3.Connection) -> str | None:
    if not _has_table(con, "tbl_slv_issue_component"):
        return None
    cols = {r[1] for r in con.execute("PRAGMA table_info(tbl_slv_issue_component)")}
    for candidate in ("component", "component_name", "name"):
        if candidate in cols:
            return candidate
    return None


def author_units(con: sqlite3.Connection) -> list[dict]:
    rows = con.execute(
        """
        SELECT c.dev_id, c.issue_key, COUNT(*) AS n_commits
        FROM tbl_slv_commit c
        JOIN tbl_slv_developer d ON d.dev_id = c.dev_id
        WHERE c.issue_key IS NOT NULL
          AND c.in_window = 1
          AND COALESCE(c.is_merge, 0) = 0
          AND COALESCE(d.is_bot, 0) = 0
          AND COALESCE(d.in_scope, 1) = 1
        GROUP BY c.dev_id, c.issue_key
        """
    ).fetchall()

    units = []
    for dev_id, issue_key, n_commits in rows:
        shas = [
            r[0]
            for r in con.execute(
                """SELECT sha FROM tbl_slv_commit
                   WHERE dev_id = ? AND issue_key = ? AND in_window = 1
                     AND COALESCE(is_merge, 0) = 0
                   ORDER BY authored_at""",
                (dev_id, issue_key),
            )
        ]
        marks = ",".join("?" * len(shas))

        messages = "\n".join(
            f"- {scrub(subject)}" + (f"\n  {clip(scrub(body), 400)}" if body else "")
            for subject, body in con.execute(
                f"""SELECT subject, body FROM tbl_slv_commit
                    WHERE sha IN ({marks}) ORDER BY authored_at""",
                shas,
            )
        )

        files = con.execute(
            f"""SELECT file_path, language, module, layer_rule, COUNT(*) AS n
                FROM tbl_slv_commit_file WHERE sha IN ({marks})
                GROUP BY file_path ORDER BY n DESC, file_path""",
            shas,
        ).fetchall()
        file_lines = "\n".join(
            f"- {path}" + (f" ({language}" if language else "")
            + (f", {module}" if module else "")
            + (f", {layer_rule}" if layer_rule else "")
            + (")" if language else "")
            for path, language, module, layer_rule, _ in files[:40]
        )
        if len(files) > 40:
            file_lines += f"\n- [... {len(files) - 40} more files]"

        patches = con.execute(
            f"""SELECT file_path, n_added, n_removed, is_truncated, added_lines
                FROM tbl_slv_commit_patch WHERE sha IN ({marks})
                ORDER BY n_added DESC""",
            shas,
        ).fetchall()
        code_budget = MAX_CODE_CHARS
        code_parts = []
        for path, n_added, n_removed, is_truncated, added in patches:
            if code_budget <= 0 or not added:
                break
            snippet = clip(scrub_code(added), min(code_budget, 1200))
            code_budget -= len(snippet)
            code_parts.append(
                f"--- {path} (+{n_added or 0}/-{n_removed or 0}"
                f"{', truncated' if is_truncated else ''})\n{snippet}"
            )
        code = "\n".join(code_parts)

        comments = "\n".join(
            f"- {clip(scrub(body), 600)}"
            for (body,) in con.execute(
                """SELECT body FROM tbl_slv_issue_comment
                   WHERE issue_key = ? AND author_dev_id = ?
                     AND COALESCE(is_bot, 0) = 0
                   ORDER BY created_at""",
                (issue_key, dev_id),
            )
        )

        # How the work was received: this is the level 2 signal.
        verdicts = con.execute(
            """SELECT r.state, COUNT(*)
               FROM tbl_slv_review r
               JOIN tbl_slv_pull_request p ON p.pr_number = r.pr_number
               WHERE p.issue_key = ? AND p.author_dev_id = ?
                 AND COALESCE(r.is_bot, 0) = 0
               GROUP BY r.state""",
            (issue_key, dev_id),
        ).fetchall()
        inspection = (
            "\n".join(f"- {state or 'unknown'}: {n}" for state, n in verdicts)
            if verdicts
            else "No human review recorded for this work."
        )

        blob = (
            issue_header(con, issue_key)
            + section("What this person changed", messages)
            + section("Files touched", file_lines)
            + section("Code they added", code)
            + section("What they wrote in the discussion", comments)
            + section("How the work was received", inspection)
        )
        blob = clip(blob, MAX_CHARS)

        units.append(
            dict(
                evidence_id=f"{dev_id}:author:{issue_key}",
                dev_id=dev_id,
                role="author",
                issue_key=issue_key,
                n_commits=n_commits,
                n_files=len(files),
                n_chars=len(blob),
                has_code=1 if code else 0,
                has_review=1 if verdicts else 0,
                text_blob=blob,
            )
        )
    return units


def reviewer_units(con: sqlite3.Connection) -> list[dict]:
    rows = con.execute(
        """
        SELECT r.reviewer_dev_id AS dev_id, p.issue_key, COUNT(*) AS n_reviews
        FROM tbl_slv_review r
        JOIN tbl_slv_pull_request p ON p.pr_number = r.pr_number
        JOIN tbl_slv_developer d ON d.dev_id = r.reviewer_dev_id
        WHERE p.issue_key IS NOT NULL
          AND r.reviewer_dev_id IS NOT NULL
          AND COALESCE(r.is_bot, 0) = 0
          AND COALESCE(d.is_bot, 0) = 0
          AND COALESCE(d.in_scope, 1) = 1
          AND r.reviewer_dev_id <> COALESCE(p.author_dev_id, '')
        GROUP BY r.reviewer_dev_id, p.issue_key
        """
    ).fetchall()

    units = []
    for dev_id, issue_key, n_reviews in rows:
        verdicts = "\n".join(
            f"- {state or 'unknown'}" + (f": {clip(scrub(body), 600)}" if body else "")
            for state, body in con.execute(
                """SELECT r.state, r.body
                   FROM tbl_slv_review r
                   JOIN tbl_slv_pull_request p ON p.pr_number = r.pr_number
                   WHERE p.issue_key = ? AND r.reviewer_dev_id = ?
                     AND COALESCE(r.is_bot, 0) = 0
                   ORDER BY r.submitted_at""",
                (issue_key, dev_id),
            )
        )
        inline = con.execute(
            """SELECT rc.file_path, rc.line_no, rc.body
               FROM tbl_slv_review_comment rc
               JOIN tbl_slv_pull_request p ON p.pr_number = rc.pr_number
               WHERE p.issue_key = ? AND rc.reviewer_dev_id = ?
                 AND COALESCE(rc.is_bot, 0) = 0
               ORDER BY rc.created_at""",
            (issue_key, dev_id),
        ).fetchall()
        inline_text = "\n".join(
            f"- {path or 'unknown file'}"
            + (f":{line_no}" if line_no is not None else "")
            + f" — {clip(scrub(body), 600)}"
            for path, line_no, body in inline
        )

        blob = (
            issue_header(con, issue_key)
            + section("This person did not write this work. They inspected it.", "")
            + section("Their verdict", verdicts)
            + section("What they pointed at in the code", inline_text)
        )
        blob = clip(blob, MAX_CHARS)

        units.append(
            dict(
                evidence_id=f"{dev_id}:reviewer:{issue_key}",
                dev_id=dev_id,
                role="reviewer",
                issue_key=issue_key,
                n_commits=0,
                n_files=len({c[0] for c in inline if c[0]}),
                n_chars=len(blob),
                has_code=0,
                has_review=1,
                text_blob=blob,
            )
        )
    return units


def main() -> None:
    if not DB.exists():
        raise SystemExit(f"Silver database not found: {DB}")
    con = sqlite3.connect(DB)
    con.execute("PRAGMA foreign_keys = ON")
    ensure_schema(con)

    units = author_units(con) + reviewer_units(con)
    built_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    # Idempotent: a rebuild replaces the table, it never appends a second copy.
    con.execute("DELETE FROM tbl_slv_evidence_unit")
    con.executemany(
        """INSERT INTO tbl_slv_evidence_unit
           (evidence_id, dev_id, role, issue_key, n_commits, n_files, n_chars,
            has_code, has_review, text_blob, built_at)
           VALUES (:evidence_id, :dev_id, :role, :issue_key, :n_commits, :n_files,
                   :n_chars, :has_code, :has_review, :text_blob, :built_at)""",
        [dict(u, built_at=built_at) for u in units],
    )
    con.execute(
        """INSERT INTO tbl_slv_build_log (step, built_at, params, n_rows)
           VALUES (?, ?, ?, ?)""",
        (
            "slv_03_evidence_units",
            built_at,
            json.dumps({"max_chars": MAX_CHARS, "max_code_chars": MAX_CODE_CHARS}),
            len(units),
        ),
    )
    con.commit()

    by_role = {}
    for u in units:
        by_role[u["role"]] = by_role.get(u["role"], 0) + 1
    people = len({u["dev_id"] for u in units})
    with_code = sum(1 for u in units if u["has_code"])
    median = sorted(u["n_chars"] for u in units)[len(units) // 2] if units else 0

    print(f"{len(units)} evidence units for {people} people")
    print(f"  by role: {by_role}")
    print(f"  with code: {with_code}  |  median size: {median} characters")
    con.close()


if __name__ == "__main__":
    main()
