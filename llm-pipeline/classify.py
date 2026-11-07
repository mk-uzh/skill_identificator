"""Classify evidence units (one API call per unit, closed category list, verbatim quotes).

Quotes are checked in code: a quote that is not a substring of the person's own
sections is dropped. Ticket text (## The task) is never accepted as a quote.
what_records_show must stay free of level words (checked in code).
"""
from __future__ import annotations

import argparse
import csv
import difflib
import json
import random
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone

from common import (
    HERE,
    classify_manifest_path,
    estimate_cost_usd,
    evidence_csv,
    has_level_words,
    has_privacy_leak,
    load_config,
    load_env,
    load_jsonl,
    norm,
    read_csv,
    run_jsonl,
    sample_csv_path,
    sha16,
)

# Ticket text is context only (R1). Quotes from this section are rejected.
_TASK_SECTION = re.compile(
    r"## The task\b.*?(?=\n## |\Z)",
    re.IGNORECASE | re.DOTALL,
)

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)

VALID_LEVELS = {"l1", "l2", "l3", "l4"}
VALID_CONF = {"H", "M", "L"}


def person_text(text: str) -> str:
    """Unit text with ## The task removed — only this may be quoted."""
    return _TASK_SECTION.sub("", text or "")


def parse_json_reply(text: str) -> dict:
    """Pull a JSON object out of the reply (raw or fenced)."""
    text = (text or "").strip()
    if not text:
        raise RuntimeError("Empty reply")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = _JSON_FENCE.search(text)
    if m:
        return json.loads(m.group(1).strip())
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        return json.loads(text[start : end + 1])
    raise RuntimeError("Could not parse JSON from reply")


def call_anthropic(
    model: str, instructions: str, unit_text: str, effort: str = "medium"
) -> tuple[dict, dict]:
    """One classification call with prompt caching on the instructions block.

    Returns (parsed_json, usage_dict).
    """
    import anthropic

    client = anthropic.Anthropic()
    msg = client.messages.create(
        model=model,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": instructions,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": unit_text}],
        output_config={"effort": effort},
    )
    parts = [b.text for b in msg.content if getattr(b, "type", None) == "text"]
    usage = {
        "input_tokens": getattr(msg.usage, "input_tokens", 0) or 0,
        "output_tokens": getattr(msg.usage, "output_tokens", 0) or 0,
        "cache_creation_input_tokens": getattr(msg.usage, "cache_creation_input_tokens", 0) or 0,
        "cache_read_input_tokens": getattr(msg.usage, "cache_read_input_tokens", 0) or 0,
    }
    return parse_json_reply("".join(parts)), usage


# Reasons for which one more try with feedback is worth the cost.
RETRYABLE_CODES = {
    "quote_not_found",
    "no_quote",
    "what_empty",
    "what_has_level_words",
    "reason_empty",
    "level_invalid",
}


def repair_quote(quote: str, allowed: str) -> str | None:
    """If `quote` is a near-miss copy of the person's text, return the exact stretch from it.

    Typical near-misses: changed punctuation or quotes, a dropped word, markup characters.
    The stored quote is always a real substring of the person's own sections.
    """
    if len(quote) < 12 or not allowed:
        return None
    sm = difflib.SequenceMatcher(None, allowed, quote, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size > 0]
    if not blocks:
        return None
    if sum(b.size for b in blocks) < 0.9 * len(quote):
        return None
    first, last = blocks[0], blocks[-1]
    start = max(0, first.a - first.b)
    end = min(len(allowed), last.a + last.size + (len(quote) - (last.b + last.size)))
    if end - start > 1.25 * len(quote) + 10:
        return None
    repaired = allowed[start:end].strip()
    return repaired[:200] if len(repaired) >= 12 else None


def keep_verified(
    obs: list, text: str, competences: set[str] | None = None
) -> tuple[list, list[dict]]:
    """Keep observations with a real person-section quote and neutral what_records_show.

    Returns (kept, dropped). Every dropped observation is described with a reason code,
    so nothing disappears without a trace. A near-miss quote is repaired to the exact text.
    """
    allowed = norm(person_text(text))
    kept: list[dict] = []
    dropped: list[dict] = []

    def drop(o, code: str) -> None:
        d = o if isinstance(o, dict) else {}
        dropped.append(
            {
                "category": d.get("category"),
                "level": d.get("level"),
                "code": code,
                "quote": norm(str(d.get("quote") or ""))[:120],
            }
        )

    for o in obs:
        if not isinstance(o, dict):
            drop(o, "not_dict")
            continue
        cat = o.get("category")
        if cat == "other":
            drop(o, "category_other")
            continue
        if not cat or (competences is not None and cat not in competences):
            drop(o, "category_invalid")
            continue
        level = str(o.get("level") or "").strip().lower()
        if level not in VALID_LEVELS:
            drop(o, "level_invalid")
            continue
        quote = norm(o.get("quote", ""))
        if len(quote) > 200:
            quote = quote[:200]
        what = norm(o.get("what_records_show") or "")
        if len(what) > 300:
            what = what[:300]
        reason = norm(o.get("reason") or "")
        if len(reason) > 300:
            reason = reason[:300]
        if not what:
            drop(o, "what_empty")
            continue
        if has_level_words(what):
            drop(o, "what_has_level_words")
            continue
        if not reason:
            drop(o, "reason_empty")
            continue
        repaired = False
        if not quote:
            drop(o, "no_quote")
            continue
        if quote not in allowed:
            fixed = repair_quote(quote, allowed)
            if fixed is None:
                drop(o, "quote_not_found")
                continue
            quote, repaired = fixed, True
        conf = str(o.get("confidence") or "M").strip().upper()
        if conf not in VALID_CONF:
            conf = "M"
        entry = {
            **o,
            "category": cat,
            "level": level,
            "quote": quote,
            "what_records_show": what,
            "reason": reason,
            "confidence": conf,  # diagnostic only; scoring ignores this
        }
        if repaired:
            entry["quote_repaired"] = True
        kept.append(entry)
    return kept[:2], dropped


def retry_message(unit_message: str, fixable: list[dict]) -> str:
    """Ask once more, naming exactly what the code check rejected."""
    lines = []
    for d in fixable:
        cat = d.get("category") or "an observation"
        code = d["code"]
        if code in ("quote_not_found", "no_quote"):
            lines.append(
                f"- {cat}: the quote was not found word for word in the person's own sections. "
                "Copy one short stretch (under 200 characters) exactly as it appears, character "
                "for character. No ellipses, no changed punctuation."
            )
        elif code == "what_has_level_words":
            lines.append(
                f"- {cat}: what_records_show must only describe what the records show, without "
                "judging words such as routine, mechanical, simple, or level names."
            )
        elif code == "level_invalid":
            lines.append(f"- {cat}: level must be one of l1, l2, l3, l4.")
        else:
            lines.append(f"- {cat}: what_records_show and reason must both be filled in.")
    return (
        unit_message
        + "\n\nYour previous reply was partly rejected by a code check:\n"
        + "\n".join(lines)
        + "\nReply again with the complete JSON object in the same format, correcting only these points."
    )


def resolve_judgeable(raw: str | None, kept: list, role: str, has_review: str) -> str:
    """Final judgeable in code: author without review is always limited."""
    judgeable = raw if raw in ("yes", "limited", "no") else ("yes" if kept else "no")
    if not kept:
        return "no"
    if role == "author" and str(has_review) in ("0", ""):
        return "limited"
    return judgeable


def usable_study_units(rows: list[dict], developers: list[str]) -> list[dict]:
    """Study persons only; drop empty text and privacy leaks so the sample is classifiable."""
    allow = set(developers)
    out = []
    for r in rows:
        if r.get("dev_id") not in allow:
            continue
        text = r.get("text") or ""
        if not text.strip():
            continue
        if has_privacy_leak(text):
            continue
        if r.get("role") not in ("author", "reviewer"):
            continue
        out.append(r)
    return out


def draw_stratified(rows: list[dict], n: int, seed: int) -> list[dict]:
    """Seeded sample stratified by (dev_id, role), aiming for coverage of every stratum.

    Each non-empty stratum gets a base share; leftovers are filled round-robin from
    strata that still have unused units (deterministic for a given seed).
    """
    if n <= 0:
        raise SystemExit("--sample N must be positive")
    buckets: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in rows:
        buckets[(r["dev_id"], r["role"])].append(r)

    rng = random.Random(seed)
    strata = sorted(buckets.keys())
    if not strata:
        raise SystemExit("No usable study units to sample from")

    # Shuffle each stratum deterministically (sort first for stable seed behaviour).
    pools: dict[tuple[str, str], list[dict]] = {}
    for key in strata:
        pool = sorted(buckets[key], key=lambda r: r["evidence_id"])
        rng.shuffle(pool)
        pools[key] = pool

    # Equal base share, capped by availability.
    base = max(1, n // len(strata))
    take = {key: min(base, len(pools[key])) for key in strata}
    total = sum(take.values())

    # If still short of n, add one at a time in shuffled stratum order.
    order = strata[:]
    rng.shuffle(order)
    while total < n:
        progressed = False
        for key in order:
            if take[key] < len(pools[key]):
                take[key] += 1
                total += 1
                progressed = True
                if total >= n:
                    break
        if not progressed:
            break

    # If equal base overshot (tiny corpora), trim from largest strata.
    while total > n:
        key = max(strata, key=lambda k: take[k])
        if take[key] <= 0:
            break
        take[key] -= 1
        total -= 1

    picked: list[dict] = []
    for key in strata:
        picked.extend(pools[key][: take[key]])
    rng.shuffle(picked)
    return picked


def write_sample_csv(path, rows: list[dict], *, n: int, seed: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(
            fh,
            fieldnames=["unit", "evidence_id", "dev_id", "role", "issue_key", "has_review"],
        )
        w.writeheader()
        for i, r in enumerate(rows, 1):
            w.writerow(
                {
                    "unit": i,
                    "evidence_id": r["evidence_id"],
                    "dev_id": r["dev_id"],
                    "role": r["role"],
                    "issue_key": r.get("issue_key", ""),
                    "has_review": r.get("has_review", ""),
                }
            )
    counts = Counter((r["dev_id"], r["role"]) for r in rows)
    print(
        f"sample: n={len(rows)} (target={n}) seed={seed} -> {path}",
        file=sys.stderr,
    )
    for (dev, role), c in sorted(counts.items()):
        print(f"  {dev} {role}: {c}", file=sys.stderr)


def run_downstream(project: str) -> None:
    """Score (text polish + sensitivity) then write assessments candidate."""
    import make_assessments
    import score

    old_argv = sys.argv
    try:
        sys.argv = ["score.py", "--project", project]
        score.main()
        sys.argv = ["make_assessments.py", "--project", project]
        make_assessments.main()
    finally:
        sys.argv = old_argv


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Classify a stratified sample, then score and write assessments"
    )
    ap.add_argument("--project", required=True, choices=["sakai", "nifi"])
    ap.add_argument(
        "--limit",
        type=int,
        required=True,
        help="How many units to classify (seeded sample across all study people × both roles)",
    )
    args = ap.parse_args()
    if args.limit <= 0:
        raise SystemExit("--limit must be a positive integer")

    load_env()
    cfg = load_config()
    competences = set(cfg["competences"])
    instructions = (HERE / "prompt.md").read_text(encoding="utf-8")
    prompt_hash = sha16(instructions)
    model = cfg["model"]
    pricing = cfg.get("pricing") or {}
    seed = int((cfg.get("sample") or {}).get("seed", 42))

    src = evidence_csv(args.project)
    if not src.exists():
        raise SystemExit(f"Missing evidence file: {src}")

    pool = usable_study_units(read_csv(src), cfg["study_developers"])
    units = draw_stratified(pool, args.limit, seed)
    sample_path = sample_csv_path(args.project)
    write_sample_csv(sample_path, units, n=args.limit, seed=seed)
    sample_meta = {
        "n_target": args.limit,
        "n_drawn": len(units),
        "seed": seed,
        "path": str(sample_path),
        "by_dev_role": {
            f"{d}|{r}": c
            for (d, r), c in sorted(Counter((u["dev_id"], u["role"]) for u in units).items())
        },
    }

    out = run_jsonl(args.project)
    if out.exists():
        out.unlink()
        print(f"removed old run file: {out}", file=sys.stderr)

    skipped_privacy = 0
    skipped_empty = 0
    n_new = 0
    n_dropped_quotes = 0
    n_retried = 0
    n_recovered = 0
    dropped_by_code: Counter = Counter()
    usage_totals = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
    }
    started = datetime.now(timezone.utc).isoformat()

    with out.open("w", encoding="utf-8") as fh:
        for row in units:
            eid = row["evidence_id"]
            text = row.get("text") or ""
            if not text.strip():
                skipped_empty += 1
                continue
            if has_privacy_leak(text):
                skipped_privacy += 1
                print(f"skip (privacy): {eid}", file=sys.stderr)
                continue

            unit = {
                "evidence_id": eid,
                "dev_id": row["dev_id"],
                "role": row["role"],
                "issue_key": row["issue_key"],
                "has_review": row.get("has_review", ""),
                "text": text,
            }
            unit_message = (
                f"Unit {eid} ({unit['role']}). Evidence unit text:\n\n{text}\n\n"
                "Reply with one JSON object only (no markdown), matching the Output section "
                "of the instructions: judgeable, and observations (at most two) each with "
                "category, level, quote, what_records_show, reason, confidence."
            )

            res = None
            usage = {
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0,
            }
            for attempt in range(3):
                try:
                    res, usage = call_anthropic(
                        model,
                        instructions,
                        unit_message,
                        effort=str(cfg.get("effort", "medium")),
                    )
                    break
                except Exception as e:
                    print(f"{eid} attempt {attempt + 1}: {e}", file=sys.stderr)
                    time.sleep(2 ** attempt)
            if res is None:
                fh.write(json.dumps({"evidence_id": eid, "error": "failed"}) + "\n")
                fh.flush()
                continue

            for k in usage_totals:
                usage_totals[k] += usage.get(k, 0) or 0

            kept, dropped = keep_verified(res.get("observations") or [], text, competences)
            retried = False
            fixable = [d for d in dropped if d["code"] in RETRYABLE_CODES]
            if fixable and len(kept) < 2:
                retried = True
                n_retried += 1
                try:
                    res2, usage2 = call_anthropic(
                        model,
                        instructions,
                        retry_message(unit_message, fixable),
                        effort=str(cfg.get("effort", "medium")),
                    )
                    for k in usage_totals:
                        usage_totals[k] += usage2.get(k, 0) or 0
                    kept2, _ = keep_verified(res2.get("observations") or [], text, competences)
                    have = {o["category"] for o in kept}
                    for o in kept2:
                        if o["category"] not in have and len(kept) < 2:
                            o["recovered_on_retry"] = True
                            kept.append(o)
                            have.add(o["category"])
                            n_recovered += 1
                except Exception as e:
                    print(f"{eid} retry failed: {e}", file=sys.stderr)
            have_cats = {o["category"] for o in kept}
            dropped = [
                d
                for d in dropped
                if d["code"] != "category_other" and d.get("category") not in have_cats
            ]
            for d in dropped:
                dropped_by_code[d["code"]] += 1
            n_dropped_quotes += sum(1 for d in dropped if d["code"] in ("quote_not_found", "no_quote"))
            judgeable = resolve_judgeable(
                res.get("judgeable"), kept, unit["role"], unit["has_review"]
            )
            record = {
                "evidence_id": eid,
                "dev_id": unit["dev_id"],
                "role": unit["role"],
                "issue_key": unit["issue_key"],
                "has_review": unit["has_review"],
                "judgeable": judgeable,
                "observations": kept,
                "dropped_unverified_quotes": sum(
                    1 for d in dropped if d["code"] in ("quote_not_found", "no_quote")
                ),
                "dropped_observations": dropped,
                "retried": retried,
                "model": model,
                "prompt_hash": prompt_hash,
                "usage": usage,
            }
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            fh.flush()
            n_new += 1

    cost = estimate_cost_usd(usage_totals, pricing)
    manifest = {
        "project": args.project,
        "started_at": started,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "prompt_hash": prompt_hash,
        "n_new": n_new,
        "skipped_empty": skipped_empty,
        "skipped_privacy": skipped_privacy,
        "unverified_quotes_dropped": n_dropped_quotes,
        "observations_dropped_by_reason": dict(dropped_by_code),
        "units_retried": n_retried,
        "observations_recovered_on_retry": n_recovered,
        "usage": usage_totals,
        "estimated_cost_usd": cost,
        "pricing": pricing,
        "sample": sample_meta,
    }
    mpath = classify_manifest_path(args.project)
    mpath.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(
        f"{args.project}: wrote {n_new} new unit(s) -> {out} "
        f"(skipped empty={skipped_empty}, privacy={skipped_privacy}; "
        f"unverified quotes dropped={n_dropped_quotes})"
    )
    print(
        f"manifest: model={model} prompt_hash={prompt_hash} "
        f"tokens in={usage_totals['input_tokens']} out={usage_totals['output_tokens']} "
        f"cache_read={usage_totals['cache_read_input_tokens']} "
        f"cache_write={usage_totals['cache_creation_input_tokens']} "
        f"est_cost_usd={cost} -> {mpath}"
    )

    rows = [r for r in load_jsonl(out) if "error" not in r]
    if not rows:
        raise SystemExit(
            f"No classifications in {out}; cannot score. Fix classify errors first."
        )

    print(f"{args.project}: running score + make_assessments …")
    run_downstream(args.project)


if __name__ == "__main__":
    main()
