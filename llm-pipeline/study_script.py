"""Pick the deliberately wrong proposals for Task 2 and write their explanation texts.

Design (see docs): two versions, A and B. In each version about a quarter of the
observable cells carry a proposal that is exactly one level off the level the
records support. The cells of A and B are disjoint, so every cell is shown
correctly in one version and wrongly in the other. Which version a participant
gets is decided in the app from the participant code.

The proposed (shown) level comes with a rewritten `level_reason`, built from the
same real records, so the text fits the level shown. Confidence, records and the
"what the records show" text stay as they are.

Usage (from llm-pipeline, needs the API key unless --no-llm):
    python study_script.py --project sakai
    python study_script.py --project nifi
Writes study-data/study-script.json (nifi: study-script.nifi.json).
"""
from __future__ import annotations

import argparse
import json
import random
import re
from collections import defaultdict
from datetime import datetime, timezone

from common import (
    HERE,
    INTERNAL_LEVEL_JARGON,
    LEVEL_LABELS,
    LEVEL_NUM,
    NUM_LEVEL,
    REPO,
    load_config,
    project_cfg,
    study_assessments_path,
)

SHARE = 0.25
MAX_WORDS = 85  # the normal level reasons are about 70 words (max 97); keep both kinds alike
SEED = 42


def script_path(project: str):
    name = "study-script.json" if project == "sakai" else f"study-script.{project}.json"
    return REPO / "study-data" / name


def eligible(a: dict) -> bool:
    return a["level"] in ("l1", "l2", "l3", "l4") and bool(a.get("evidence")) and bool(a.get("rationale"))


def pick(assessments: list[dict], seed: int, share: float) -> dict[str, list[dict]]:
    """Disjoint wrong-cell sets for A and B, spread evenly over the people."""
    rng = random.Random(seed)
    by_dev: dict[str, list[dict]] = defaultdict(list)
    for a in assessments:
        if eligible(a):
            by_dev[a["developer_id"]].append(a)
    chosen: dict[str, list[dict]] = {"A": [], "B": []}
    for dev in sorted(by_dev):
        pool = sorted(by_dev[dev], key=lambda c: c["category_id"])
        rng.shuffle(pool)
        k = min(max(1, round(share * len(pool))), len(pool) // 2) if len(pool) >= 2 else 0
        chosen["A"] += pool[:k]
        chosen["B"] += pool[k : 2 * k]
    return chosen


def assign_direction(cells: list[dict], seed: int) -> list[tuple[dict, int]]:
    """l1 can only go up, l4 only down; the others balance the two directions."""
    rng = random.Random(seed)
    out: list[tuple[dict, int]] = []
    ups = downs = 0
    free = []
    for c in cells:
        if c["level"] == "l1":
            out.append((c, 1)); ups += 1
        elif c["level"] == "l4":
            out.append((c, -1)); downs += 1
        else:
            free.append(c)
    rng.shuffle(free)
    for c in free:
        if ups <= downs:
            out.append((c, 1)); ups += 1
        else:
            out.append((c, -1)); downs += 1
    return out


def sentences(text: str) -> int:
    return len([s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s])


def reject_reason(text: str, shown: str, nxt: str | None) -> str | None:
    n = sentences(text)
    if not 2 <= n <= 3:
        return f"it has {n} sentences; it needs 2 or 3"
    if INTERNAL_LEVEL_JARGON.search(text):
        return "it contains level codes or internal words; use only the level titles"
    if f"«{LEVEL_LABELS[shown]}»" not in text:
        return f"it must name «{LEVEL_LABELS[shown]}» exactly"
    if nxt and f"«{LEVEL_LABELS[nxt]}»" not in text:
        return f"it must name the next level «{LEVEL_LABELS[nxt]}» exactly"
    words = len(text.split())
    if words > MAX_WORDS:
        return f"it has {words} words; it needs at most {MAX_WORDS}"
    if re.search(r"(could|may|might) (be|have been) (wrong|incorrect)|on purpose|deliberate(ly)?\b|not (really )?sure", text, re.I):
        return "it must not say that the level could be wrong or chosen on purpose"
    return None


def message(cell: dict, shown: str, nxt: str | None) -> str:
    lines = [
        f"Level to explain: «{LEVEL_LABELS[shown]}»",
        f"Next level above: «{LEVEL_LABELS[nxt]}»" if nxt else "Next level above: none (this is the highest level)",
        "",
        f"What the records show: {cell['rationale']}",
        "Records:",
    ]
    for e in cell["evidence"][:3]:
        lines.append(f"- {e.get('title', '')}: {e.get('note', '')}".rstrip(": "))
    return "\n".join(lines)


def fallback(cell: dict, shown: str, nxt: str | None) -> str:
    first = re.split(r"(?<=[.!?])\s+", cell["rationale"].strip())[0]
    text = f"The records support «{LEVEL_LABELS[shown]}». {first}"
    if nxt:
        text += f" They do not yet support «{LEVEL_LABELS[nxt]}»."
    return text


def clean_reply(raw: str) -> str:
    """The model should answer with the text only; tolerate code fences and a JSON wrapper."""
    s = raw.strip()
    s = re.sub(r"^```(?:json|text)?\s*|\s*```$", "", s).strip()
    if s.startswith("{"):
        try:
            return str(json.loads(s).get("level_reason", "")).strip()
        except ValueError:
            m = re.search(r'"level_reason"\s*:\s*"(.*)"\s*}?\s*$', s, re.S)
            return (m.group(1) if m else s).replace('\\"', '"').strip()
    return s.strip('"').strip()


def write_text(cell: dict, shown: str, cfg: dict, use_llm: bool) -> tuple[str, str]:
    nxt_num = LEVEL_NUM[shown] + 1
    nxt = NUM_LEVEL.get(nxt_num)
    if not use_llm:
        return fallback(cell, shown, nxt), "fallback"
    import anthropic

    instructions = (HERE / "wrong_level_text.md").read_text(encoding="utf-8")
    effort = str(cfg.get("texts_effort") or cfg.get("effort", "medium"))
    base = message(cell, shown, nxt)
    feedback = ""
    client = anthropic.Anthropic()
    for attempt in range(1, 4):
        try:
            msg = client.messages.create(
                model=cfg["model"],
                max_tokens=1024,
                system=[{"type": "text", "text": instructions, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": base + feedback}],
                output_config={"effort": effort},
            )
            text = clean_reply("".join(b.text for b in msg.content if getattr(b, "type", None) == "text"))
        except Exception as e:  # noqa: BLE001
            print(f"  {cell['developer_id']}/{cell['category_id']} attempt {attempt}: {e}")
            continue
        why = reject_reason(text, shown, nxt)
        if why is None:
            return text, "model"
        print(f"  reject {cell['developer_id']}/{cell['category_id']} attempt {attempt}: {why}")
        feedback = f"\n\nYour previous text was rejected because {why}. Write it again."
    return fallback(cell, shown, nxt), "fallback"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, choices=["sakai", "nifi"])
    ap.add_argument("--share", type=float, default=SHARE)
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--no-llm", action="store_true", help="use template texts only (no API call)")
    ap.add_argument("--force", action="store_true", help="write texts again even if the file already has them")
    a = ap.parse_args()

    cfg = load_config()
    project_cfg(cfg, a.project)
    src = study_assessments_path(a.project)
    data = json.loads(src.read_text(encoding="utf-8"))
    cells = {(x["developer_id"], x["category_id"]): x for x in data["assessments"]}

    old = {}
    out_path = script_path(a.project)
    if out_path.exists() and not a.force:
        prev = json.loads(out_path.read_text(encoding="utf-8"))
        if prev.get("assessments_hash") == data.get("config_hash") and prev.get("seed") == a.seed:
            for v in ("A", "B"):
                for w in prev["versions"].get(v, []):
                    old[(v, w["developer_id"], w["category_id"])] = w

    if not a.no_llm:
        from classify import load_env

        load_env()

    chosen = pick(data["assessments"], a.seed, a.share)
    versions: dict[str, list[dict]] = {}
    counts = {"model": 0, "fallback": 0, "reused": 0}
    for v in ("A", "B"):
        rows = []
        for cell, delta in assign_direction(chosen[v], a.seed + (1 if v == "B" else 0)):
            true = cell["level"]
            shown = NUM_LEVEL[LEVEL_NUM[true] + delta]
            key = (v, cell["developer_id"], cell["category_id"])
            prev = old.get(key)
            if (prev and prev["shown_level"] == shown and prev["true_level"] == true and prev.get("level_reason")
                    and (a.no_llm or prev.get("source") == "model")):
                text, source = prev["level_reason"], prev.get("source", "model")
                counts["reused"] += 1
            else:
                text, source = write_text(cell, shown, cfg, not a.no_llm)
                counts[source] += 1
            rows.append({
                "developer_id": cell["developer_id"],
                "category_id": cell["category_id"],
                "true_level": true,
                "shown_level": shown,
                "direction": "raise" if delta > 0 else "lower",
                "level_reason": text,
                "source": source,
            })
        versions[v] = sorted(rows, key=lambda r: (r["developer_id"], r["category_id"]))

    out = {
        "project": a.project,
        "seed": a.seed,
        "share": a.share,
        "computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "assessments_hash": data.get("config_hash"),
        "versions": versions,
    }
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    for v in ("A", "B"):
        d = [r["direction"] for r in versions[v]]
        print(f"{a.project} version {v}: {len(d)} wrong cells ({d.count('raise')} raise, {d.count('lower')} lower), "
              f"people {len({r['developer_id'] for r in versions[v]})}")
    print(f"texts: {counts}  -> {out_path}")
    both = {(r['developer_id'], r['category_id']) for r in versions['A']} & {(r['developer_id'], r['category_id']) for r in versions['B']}
    assert not both, "versions overlap"


if __name__ == "__main__":
    main()
