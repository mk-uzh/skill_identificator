"""Combine unit classifications into one level per person and competence. Scoring is in code.

After scoring, polishes rationale and level_reason with a short LLM call per observable
person × competence (default). Also writes a sensitivity comparison across scoring variants.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from common import (
    HERE,
    LEVEL_LABELS,
    LEVEL_NUM,
    NUM_LEVEL,
    estimate_cost_usd,
    has_internal_jargon,
    has_level_words,
    load_config,
    load_env,
    load_jsonl,
    norm,
    profiles_path,
    project_cfg,
    read_csv,
    run_jsonl,
    sensitivity_path,
    sha16,
    silver_dir,
    texts_cache_path,
)

NEXT_LEVEL = {"l1": "l2", "l2": "l3", "l3": "l4", "l4": "l5", "l5": None}

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)
_BULLETS = re.compile(r"(?m)^\s*([-•*]|\d+[.)])\s+")


def load_indexes(project: str) -> dict:
    """Load silver CSVs and build small lookup maps for rich evidence titles."""
    d = silver_dir(project)
    commits = read_csv(d / "slv_commit.csv") if (d / "slv_commit.csv").exists() else []
    prs = read_csv(d / "slv_pull_request.csv") if (d / "slv_pull_request.csv").exists() else []
    issues = read_csv(d / "slv_issue.csv") if (d / "slv_issue.csv").exists() else []
    reviews = read_csv(d / "slv_review.csv") if (d / "slv_review.csv").exists() else []

    by_issue_pr: dict[str, list] = defaultdict(list)
    for p in prs:
        if p.get("issue_key"):
            by_issue_pr[p["issue_key"]].append(p)

    by_dev_issue_commit: dict[tuple[str, str], list] = defaultdict(list)
    for c in commits:
        if c.get("dev_id") and c.get("issue_key") and c.get("is_merge", "0") != "1":
            by_dev_issue_commit[(c["dev_id"], c["issue_key"])].append(c)

    pr_to_issue = {str(p["pr_number"]): p.get("issue_key") for p in prs}
    by_dev_issue_review: dict[tuple[str, str], list] = defaultdict(list)
    for r in reviews:
        issue = pr_to_issue.get(str(r.get("pr_number")))
        if issue and r.get("reviewer_dev_id"):
            by_dev_issue_review[(r["reviewer_dev_id"], issue)].append(r)

    return {
        "issue": {i["issue_key"]: i for i in issues if i.get("issue_key")},
        "pr": by_issue_pr,
        "commit": by_dev_issue_commit,
        "review": by_dev_issue_review,
    }


def _real_ts(ts: str | None) -> str | None:
    """Keep only real timestamps; omit missing or Unix-epoch placeholders."""
    if not ts or not str(ts).strip():
        return None
    s = str(ts).strip()
    if s.startswith("1970-01-01"):
        return None
    return s


def item(kind: str, title: str, ts: str | None, url: str, note: str | None = None) -> dict:
    out = {
        "kind": kind,
        "title": (title or kind)[:200],
        "url": url,
    }
    real = _real_ts(ts)
    if real:
        out["timestamp"] = real
    n = norm(note or "")
    if n:
        out["note"] = n[:300]
    return out


_HINT_STOP = {
    "update", "updated", "change", "changed", "changes", "added", "adds", "this", "that",
    "with", "from", "into", "were", "when", "which", "also", "only", "more", "other",
    "their", "person", "records", "show", "shows", "fixed", "files", "file", "code",
}


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z][a-z0-9_]{3,}", (text or "").lower())) - _HINT_STOP


def _pick_by_hint(rows: list[dict], text_of, hint: str, when_of) -> dict | None:
    """The row whose title shares most words with the hint; newest wins a tie.

    One issue can hold several changes (two commits, two pull requests). The unit's
    own sentence says which change it is about, so the link must follow that sentence.
    """
    ordered = sorted(rows, key=lambda r: when_of(r) or "", reverse=True)
    if not ordered:
        return None
    h = _tokens(hint)
    if not h:
        return ordered[0]
    return max(ordered, key=lambda r: len(_tokens(text_of(r)) & h))


_PR_IN_SUBJECT = re.compile(r"\(#(\d+)\)\s*$")


def evidence_for_unit(meta: dict, proj: dict, ix: dict, hint: str = "") -> list[dict]:
    """Build commit/PR/review/issue links with titles from silver."""
    owner, repo = proj["github_owner"], proj["github_repo"]
    jira = proj["jira_base"].rstrip("/")
    dev, issue, role = meta["dev_id"], meta["issue_key"], meta["role"]
    items: list[dict] = []

    if role == "author":
        c = _pick_by_hint(
            ix["commit"].get((dev, issue), []),
            lambda x: x.get("subject") or "",
            hint,
            lambda x: x.get("authored_at"),
        )
        if c:
            items.append(
                item(
                    "commit",
                    c.get("subject") or issue,
                    c.get("authored_at"),
                    f"https://github.com/{owner}/{repo}/commit/{c['sha']}",
                )
            )
        prs = ix["pr"].get(issue, [])
        p = None
        if c:
            # The commit subject usually ends in "(#1234)": that is its own pull request.
            m = _PR_IN_SUBJECT.search(c.get("subject") or "")
            if m:
                p = next((x for x in prs if str(x.get("pr_number")) == m.group(1)), None)
        if p is None:
            p = _pick_by_hint(
                prs, lambda x: x.get("title") or "", hint, lambda x: x.get("created_at")
            )
        if p:
            items.append(
                item(
                    "pull_request",
                    p.get("title") or f"PR {p['pr_number']}",
                    p.get("created_at"),
                    f"https://github.com/{owner}/{repo}/pull/{p['pr_number']}",
                )
            )
    else:
        pr_title = {
            str(x.get("pr_number")): x.get("title") or "" for x in ix["pr"].get(issue, [])
        }
        r = _pick_by_hint(
            ix["review"].get((dev, issue), []),
            lambda x: pr_title.get(str(x.get("pr_number")), ""),
            hint,
            lambda x: x.get("submitted_at"),
        )
        if r:
            items.append(
                item(
                    "review",
                    f"Review on {issue}",
                    r.get("submitted_at"),
                    f"https://github.com/{owner}/{repo}/pull/{r['pr_number']}",
                )
            )
        elif ix["pr"].get(issue):
            p = ix["pr"][issue][0]
            items.append(
                item(
                    "pull_request",
                    p.get("title") or f"PR {p['pr_number']}",
                    p.get("created_at"),
                    f"https://github.com/{owner}/{repo}/pull/{p['pr_number']}",
                )
            )

    iss = ix["issue"].get(issue)
    if iss:
        items.append(
            item("issue", iss.get("summary") or issue, iss.get("created_at"), f"{jira}/{issue}")
        )
    elif issue:
        # Issue key known from the unit but missing from silver — link without a fake date.
        items.append(item("issue", issue, None, f"{jira}/{issue}"))

    seen, out = set(), []
    for it in items:
        if it["url"] in seen:
            continue
        seen.add(it["url"])
        out.append(it)
    return out


_KIND_RANK = {"commit": 0, "review": 1, "pull_request": 2, "issue": 3}


def evidence_item_for_unit(
    meta: dict, proj: dict, ix: dict, what_records_show: str, quote: str = ""
) -> dict | None:
    """One evidence row per unit: primary link + short note from what_records_show."""
    links = evidence_for_unit(meta, proj, ix, hint=f"{what_records_show} {quote}")
    if not links:
        return None
    primary = min(links, key=lambda e: _KIND_RANK.get(e["kind"], 9))
    return item(
        primary["kind"],
        primary["title"],
        primary.get("timestamp"),
        primary["url"],
        note=what_records_show,
    )


def usable_for_level(obs: list[dict], sc: dict) -> list[dict]:
    """Observations that may raise the person-level (judgeable=yes by default)."""
    if sc.get("limited_raises_level", False):
        return [o for o in obs if o.get("level") in LEVEL_NUM]
    return [o for o in obs if o.get("judgeable") == "yes" and o.get("level") in LEVEL_NUM]


def evidence_confidence(obs: list[dict]) -> tuple[float, dict]:
    """Confidence from the quality of the evidence, never from how much of it there is.

    Two inputs: how many of the person's own changes were accepted after a review
    (review_rate), and how many units could be judged without restriction
    (share_judgeable). Design principle MR19: volume is not ability.
    """
    if not obs:
        return 0.9, {"review_rate": None, "share_judgeable": None}
    authors = [o for o in obs if o.get("role") == "author"]
    if authors:
        reviewed = sum(1 for o in authors if str(o.get("has_review", "1")) not in ("0", ""))
        review_rate = reviewed / len(authors)
    else:
        review_rate = 1.0
    share_judgeable = sum(1 for o in obs if o.get("judgeable", "yes") == "yes") / len(obs)
    conf = round(max(0.15, min(0.95, 0.35 + 0.45 * review_rate + 0.15 * share_judgeable)), 2)
    return conf, {"review_rate": round(review_rate, 2), "share_judgeable": round(share_judgeable, 2)}


def score_cell(obs: list[dict], sc: dict) -> dict:
    """Pick level + confidence from unit observations."""
    empty = {
        "level": "not_observable",
        "confidence": 0.9,
        "n_units": 0,
        "level_rule": "no observations",
        "acceptance_uncertain": False,
        "confidence_breakdown": {"review_rate": None, "share_judgeable": None},
        "model_confidence_diagnostic": [],
        "cell_obs": [],
    }
    if not obs:
        return empty

    cell_obs = sorted(obs, key=lambda x: LEVEL_NUM.get(x.get("level"), 0), reverse=True)
    raising = usable_for_level(obs, sc)
    levels = [LEVEL_NUM[o["level"]] for o in raising]
    if not levels:
        conf, br = evidence_confidence(obs)
        return {
            "level": "not_observable",
            "confidence": conf,
            "n_units": len(obs),
            "level_rule": "limited or unusable only (no raising units)",
            "acceptance_uncertain": any(
                o.get("role") == "author" and str(o.get("has_review", "1")) in ("0", "") for o in obs
            ),
            "confidence_breakdown": br,
            "model_confidence_diagnostic": [o.get("confidence") for o in obs if o.get("confidence")],
            "cell_obs": cell_obs,
        }

    peak = max(levels)
    support_peak = sum(1 for x in levels if x == peak)
    support_ge3 = sum(1 for x in levels if x >= 3)
    base, rule = peak, f"peak={NUM_LEVEL[peak]}"

    mode = sc.get("level_mode", "peak")
    min_ge3 = int(sc.get("min_units_ge3", 1))
    if mode == "min_support" and peak >= 3 and support_peak < min_ge3:
        while base >= 3 and sum(1 for x in levels if x == base) < min_ge3:
            base -= 1
        rule = f"min_support<{min_ge3} at peak -> {NUM_LEVEL[base]}"

    if base == 4 and support_peak < sc["l4_min_peak"] and support_ge3 < sc["l4_min_ge3"]:
        base, rule = 3, "thin l4 support -> l3"
    # No promotion to l5: it is not observable from commits and reviews (MR19, no counting).

    authors = [o for o in obs if o.get("role") == "author"]
    uncertain = bool(authors) and (
        sum(1 for o in authors if str(o.get("has_review", "1")) in ("0", "")) > len(authors) / 2
    )
    conf, br = evidence_confidence(obs)
    return {
        "level": NUM_LEVEL[base],
        "confidence": conf,
        "n_units": len(obs),
        "level_rule": rule,
        "acceptance_uncertain": uncertain,
        "confidence_breakdown": br,
        "model_confidence_diagnostic": [o.get("confidence") for o in obs if o.get("confidence")],
        "cell_obs": cell_obs,
    }


def unique_unit_notes(obs: list[dict]) -> list[dict]:
    """Deduplicate unit notes so the same sentence is not sent twice."""
    seen: set[str] = set()
    out = []
    for o in obs:
        what = norm(o.get("what_records_show") or "")
        key = what.lower()
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        out.append(o)
    return out


def fallback_texts(cat: str, cell: dict) -> tuple[str, str, str]:
    """Concat fallback when the polish call is skipped or fails. No fixed Not-lN boilerplate."""
    label = cat.replace("_", " ")
    if cell["level"] == "not_observable":
        if cell.get("n_units", 0) > 0:
            # Mentions exist but none may raise the person level (e.g. author, no review).
            return (
                f"These records mention {label}, but only in units that cannot stand alone "
                "for a rating (for example an author change with no recorded human review).",
                "Not observable: the coded mentions do not support assigning a level on their own.",
                "Some linked units lack a recorded human review, so they stay out of the level.",
            )
        return (
            f"These records show nothing about {label}. There are no coded units for this competence.",
            "Not observable: no unit showed this competence in what the person wrote or did.",
            "The public records simply do not mention this competence for this person.",
        )

    all_obs = cell.get("cell_obs") or []
    notes = unique_unit_notes(all_obs)
    reason_src = [o for o in notes if o.get("level") == cell["level"]] or notes

    parts = []
    for o in notes:
        w = (o.get("what_records_show") or "").strip()
        # The unit sentences say "The reviewer ..." for the person's own review comment.
        w = re.sub(r"^The reviewer\b", "The person, as reviewer,", w)
        if w and not has_level_words(w):
            parts.append(w)
    if not parts and notes:
        q = (notes[0].get("quote") or "").strip()
        if q:
            parts.append(f"The records include: «{q}»")
    n = int(cell.get("n_units") or len(all_obs) or 0)
    if parts:
        shown = parts[:3]
        body = " ".join(shown)
        rationale = f"Across {n} units, {body[0].lower() + body[1:]}" if n > 1 else body
        if n > len(shown):
            rationale += f" {n - len(shown)} more units are recorded for this competence."
    else:
        rationale = (
            f"Of the units linked to this competence, {n} carry a coded observation."
        )

    _DATA_REMARK = re.compile(
        r"task text|ticket text|is missing|clipped|cut off|judgement is limited|unit is|"
        r"context is incomplete",
        re.I,
    )

    def scrub(r: str) -> str:
        # Remarks about the data itself are for us, not for the reader.
        r = " ".join(x for x in re.split(r"(?<=[.!?])\s+", r) if not _DATA_REMARK.search(x))
        r = re.sub(r"\bl[1-5][a-c]?\b", "", r, flags=re.I)
        r = re.sub(r"\bnot\s*l[1-5]\b:?", "", r, flags=re.I)
        r = re.sub(r"\b(clipped|borderline|thin l4)\b", "", r, flags=re.I)
        return re.sub(r"\s+", " ", r).strip(" :.-")

    reasons = [
        scrub(o.get("reason") or "")
        for o in reason_src
        if scrub(o.get("reason") or "")
    ]
    level_name = LEVEL_LABELS.get(cell["level"], cell["level"])
    nxt = NEXT_LEVEL.get(cell["level"])
    nxt_name = LEVEL_LABELS.get(nxt, "") if nxt else ""
    if reasons:
        why = reasons[0]
        if why and why[0].isupper():
            why = why[0].lower() + why[1:]
        level_reason = f"The records support «{level_name}» because {why}."
        if nxt_name:
            level_reason += f" They do not yet support «{nxt_name}» for this competence."
    else:
        level_reason = (
            f"The coded units support «{level_name}»."
            + (f" They do not yet support «{nxt_name}»." if nxt_name else "")
        )

    blind = [
        "private conversation and pair work that never hit the tracker",
        "work outside the observation window",
    ]
    if cell["acceptance_uncertain"]:
        blind.insert(0, "several author units have no recorded human review")
    return rationale, level_reason, "; ".join(blind)


def collect_observations(rows: list[dict], competences: list[str]) -> dict[tuple[str, str], list[dict]]:
    by_cell: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in rows:
        judgeable = r.get("judgeable") or "yes"
        if r.get("role") == "author" and str(r.get("has_review", "1")) in ("0", ""):
            judgeable = "limited"
        for o in r.get("observations") or []:
            cat = o.get("category")
            if not cat or cat == "other" or cat not in competences:
                continue
            by_cell[(r["dev_id"], cat)].append(
                {
                    "level": o["level"],
                    "confidence": o.get("confidence", "M"),
                    "what_records_show": o.get("what_records_show", ""),
                    "reason": o.get("reason", ""),
                    "role": r["role"],
                    "issue_key": r["issue_key"],
                    "quote": o.get("quote", ""),
                    "has_review": r.get("has_review", ""),
                    "evidence_id": r["evidence_id"],
                    "judgeable": judgeable,
                }
            )
    return by_cell


def build_profiles(
    rows: list[dict],
    competences: list[str],
    sc: dict,
    proj: dict,
    ix: dict,
) -> list[dict]:
    """Score only. Texts are draft fallbacks; polish_texts() rewrites observable cells."""
    unit_meta = {
        r["evidence_id"]: {
            "dev_id": r["dev_id"],
            "role": r["role"],
            "issue_key": r["issue_key"],
            "has_review": r.get("has_review", ""),
        }
        for r in rows
    }
    by_cell = collect_observations(rows, competences)
    profiles = []
    for dev in sorted({r["dev_id"] for r in rows}):
        for cat in competences:
            obs = by_cell.get((dev, cat), [])
            cell = score_cell(obs, sc)
            # One evidence row per unit (note = what_records_show); no max-3 cap.
            evid: list[dict] = []
            seen_eid: set[str] = set()
            for o in sorted(obs, key=lambda x: LEVEL_NUM.get(x["level"], 0), reverse=True):
                eid = o["evidence_id"]
                if eid in seen_eid:
                    continue
                seen_eid.add(eid)
                row = evidence_item_for_unit(
                    unit_meta[eid],
                    proj,
                    ix,
                    o.get("what_records_show") or "",
                    o.get("quote") or "",
                )
                if row:
                    evid.append(row)

            rationale, level_reason, blind = fallback_texts(cat, cell)
            profiles.append(
                {
                    "developer_id": dev,
                    "category_id": cat,
                    "level": cell["level"],
                    "confidence": cell["confidence"],
                    "rationale": rationale,
                    "level_reason": level_reason,
                    "blind_spots": blind,
                    "evidence": evid,
                    "n_units": cell["n_units"],
                    "level_rule": cell["level_rule"],
                    "confidence_breakdown": cell["confidence_breakdown"],
                    "model_confidence_diagnostic": cell["model_confidence_diagnostic"],
                    "_cell_obs": cell.get("cell_obs") or [],
                }
            )
    return profiles


def parse_json_reply(text: str) -> dict:
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


def call_polish(model: str, instructions: str, user: str, effort: str) -> tuple[dict, dict]:
    import anthropic

    client = anthropic.Anthropic()
    msg = client.messages.create(
        model=model,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": instructions,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user}],
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


def polish_reject_reason(rationale: str, level_reason: str) -> str | None:
    """None if both texts are acceptable, else a plain description of what is wrong."""
    if not rationale.strip() or not level_reason.strip():
        return "rationale and level_reason must both be filled in"
    if has_level_words(rationale):
        return (
            "the rationale contains judging or level words (for example routine, mechanical, "
            "simple, not observable); describe only what the records show"
        )
    if _BULLETS.search(rationale) or _BULLETS.search(level_reason):
        return "no bullet points or numbered lists; write flowing sentences"
    if has_internal_jargon(level_reason):
        return (
            "the level_reason contains internal codes or words (l1 to l5, Not l3, borderline, "
            "clipped); use the level titles instead"
        )
    if len(rationale) > 1200:
        return (
            f"the rationale has {len(rationale)} characters; keep it under about 110 words "
            "and group similar units with a count"
        )
    if len(level_reason) > 900:
        return f"the level_reason has {len(level_reason)} characters; keep it to 2 or 3 short sentences"
    sentences = [x for x in re.split(r"[.!?]+", level_reason) if x.strip()]
    if len(sentences) < 2 or len(sentences) > 4:
        return f"the level_reason has {len(sentences)} sentences; it needs 2 or 3"
    return None


def polish_ok(rationale: str, level_reason: str) -> bool:
    return polish_reject_reason(rationale, level_reason) is None


def cell_pack(profile: dict) -> dict:
    """Facts sent to the polish call: every unit in the cell (no truncation)."""
    level = profile["level"]
    nxt = NEXT_LEVEL.get(level)
    obs = profile.get("_cell_obs") or []
    units = []
    for o in obs:
        units.append(
            {
                "issue": o.get("issue_key"),
                "role": o.get("role"),
                "quote": (o.get("quote") or "")[:200],
                "what_records_show": o.get("what_records_show") or "",
                "unit_reason": o.get("reason") or "",
            }
        )
    return {
        "competence": profile["category_id"].replace("_", " "),
        "assigned_level_title": LEVEL_LABELS.get(level, level),
        "next_level_title": LEVEL_LABELS.get(nxt, "") if nxt else None,
        "n_units": len(units),
        "units": units,
        "evidence_titles": [e.get("title") for e in profile.get("evidence") or []],
    }


def polish_texts(profiles: list[dict], cfg: dict) -> dict:
    """Rewrite rationale / level_reason for observable cells. Mutates profiles."""
    instructions = (HERE / "text_polish.md").read_text(encoding="utf-8")
    prompt_hash = sha16(instructions)
    model = cfg["model"]
    effort = str(cfg.get("texts_effort") or cfg.get("effort", "medium"))
    pricing = cfg.get("pricing") or {}
    project = cfg.get("_project", "sakai")
    cache_path = texts_cache_path(project)
    cache: dict = {}
    if cache_path.exists():
        try:
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            cache = {}

    usage_totals = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
    }
    n_polished = 0
    n_cached = 0
    n_fallback = 0
    started = datetime.now(timezone.utc).isoformat()

    for p in profiles:
        if p["level"] == "not_observable":
            p.pop("_cell_obs", None)
            continue

        pack = cell_pack(p)
        key = sha16(json.dumps({"prompt": prompt_hash, "pack": pack}, sort_keys=True))
        if key in cache and polish_ok(cache[key].get("rationale", ""), cache[key].get("level_reason", "")):
            p["rationale"] = cache[key]["rationale"]
            p["level_reason"] = cache[key]["level_reason"]
            p["texts_source"] = "cache"
            n_cached += 1
            p.pop("_cell_obs", None)
            continue

        user = (
            "Write rationale and level_reason for this cell. "
            "Use every unit in the list (group similar ones with a count).\n\n"
            + json.dumps(pack, ensure_ascii=False, indent=2)
            + "\n\nReturn one JSON object only."
        )

        got = None
        last_reject = ""
        for attempt in range(3):
            try:
                msg = user
                if last_reject:
                    msg += (
                        f"\n\nYour previous answer was rejected by a code check: {last_reject}. "
                        "Write both texts again and fix exactly this."
                    )
                res, usage = call_polish(model, instructions, msg, effort)
                for k in usage_totals:
                    usage_totals[k] += usage.get(k, 0) or 0
                rat = norm(res.get("rationale") or "")
                lr = norm(res.get("level_reason") or "")
                last_reject = polish_reject_reason(rat, lr) or ""
                if not last_reject:
                    got = {"rationale": rat, "level_reason": lr}
                    break
                print(
                    f"polish reject {p['developer_id']}/{p['category_id']} "
                    f"attempt {attempt+1}: {last_reject}",
                    file=sys.stderr,
                )
            except Exception as e:
                print(
                    f"polish fail {p['developer_id']}/{p['category_id']}: {e}",
                    file=sys.stderr,
                )
                time.sleep(1)

        if got:
            p["rationale"] = got["rationale"]
            p["level_reason"] = got["level_reason"]
            p["texts_source"] = "llm"
            cache[key] = got
            n_polished += 1
        else:
            p["texts_source"] = "fallback"
            p["texts_reject_reason"] = last_reject or "call failed"
            n_fallback += 1
        p.pop("_cell_obs", None)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    cost = estimate_cost_usd(usage_totals, pricing)
    return {
        "project": project,
        "started_at": started,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "prompt_hash": prompt_hash,
        "n_polished": n_polished,
        "n_cached": n_cached,
        "n_fallback": n_fallback,
        "usage": usage_totals,
        "estimated_cost_usd": cost,
        "cache_path": str(cache_path),
    }


def level_map(profiles: list[dict]) -> dict[tuple[str, str], str]:
    return {(p["developer_id"], p["category_id"]): p["level"] for p in profiles}


def run_sensitivity(
    project: str,
    rows: list[dict],
    competences: list[str],
    base_sc: dict,
    variants: list[dict],
    proj: dict,
    ix: dict,
) -> Path | None:
    """Re-score under each config sensitivity variant; write comparison JSON.

    Levels only — does not call the text-polish step.
    """
    if not variants:
        return None

    results = []
    maps: dict[str, dict[tuple[str, str], str]] = {}
    for var in variants:
        name = var["name"]
        sc = {**base_sc, **{k: v for k, v in var.items() if k != "name"}}
        profiles = build_profiles(rows, competences, sc, proj, ix)
        for p in profiles:
            p.pop("_cell_obs", None)
        lm = level_map(profiles)
        maps[name] = lm
        dist = Counter(lm.values())
        results.append(
            {
                "name": name,
                "scoring": {
                    k: sc[k]
                    for k in (
                        "level_mode",
                        "min_units_ge3",
                        "l4_min_peak",
                        "l4_min_ge3",
                        "limited_raises_level",
                    )
                    if k in sc
                },
                "n_profiles": len(profiles),
                "level_counts": dict(sorted(dist.items())),
            }
        )
        print(f"  sensitivity {name}: {dict(sorted(dist.items()))}")

    baseline = variants[0]["name"]
    base = maps[baseline]
    pairwise = []
    for name, lm in maps.items():
        if name == baseline:
            continue
        changed = [
            {
                "developer_id": d,
                "category_id": c,
                "baseline": base[(d, c)],
                "variant": lm[(d, c)],
            }
            for (d, c) in base
            if base[(d, c)] != lm[(d, c)]
        ]
        pairwise.append(
            {
                "baseline": baseline,
                "variant": name,
                "n_changed": len(changed),
                "n_compared": len(base),
                "share_changed": round(len(changed) / len(base), 4) if base else 0.0,
                "changes": changed[:50],
            }
        )
        print(f"  {baseline} vs {name}: {len(changed)}/{len(base)} levels differ")

    path = sensitivity_path(project)
    path.write_text(
        json.dumps(
            {
                "project": project,
                "baseline": baseline,
                "variants": results,
                "pairwise_vs_baseline": pairwise,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    return path


def main() -> None:
    ap = argparse.ArgumentParser(description="Score person × competence from unit results")
    ap.add_argument("--project", required=True, choices=["sakai", "nifi"])
    args = ap.parse_args()

    load_env()
    cfg = load_config()
    cfg["_project"] = args.project
    proj = project_cfg(cfg, args.project)
    sc = cfg["scoring"]
    competences = cfg["competences"]

    rows = [r for r in load_jsonl(run_jsonl(args.project)) if "error" not in r]
    if not rows:
        raise SystemExit(f"No classifications in {run_jsonl(args.project)}. Run classify.py first.")

    ix = load_indexes(args.project)
    profiles = build_profiles(rows, competences, sc, proj, ix)

    # Always polish readable texts for the baseline profiles.
    polish_report = polish_texts(profiles, cfg)
    print(
        f"{args.project}: texts polished={polish_report['n_polished']} "
        f"cached={polish_report['n_cached']} fallback={polish_report['n_fallback']} "
        f"est_cost_usd={polish_report['estimated_cost_usd']}"
    )

    out = profiles_path(args.project)
    out.write_text(
        json.dumps(
            {
                "project": args.project,
                "scoring": sc,
                "n_profiles": len(profiles),
                "n_units_classified": len(rows),
                "text_polish": {
                    k: polish_report[k]
                    for k in (
                        "model",
                        "prompt_hash",
                        "n_polished",
                        "n_cached",
                        "n_fallback",
                        "usage",
                        "estimated_cost_usd",
                    )
                },
                "profiles": profiles,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    n_obs = sum(1 for p in profiles if p["level"] != "not_observable")
    print(f"{args.project}: {len(profiles)} profiles ({n_obs} observable) -> {out}")

    sens = run_sensitivity(
        args.project,
        rows,
        competences,
        sc,
        cfg.get("sensitivity") or [],
        proj,
        ix,
    )
    if sens:
        print(f"{args.project}: sensitivity -> {sens}")


if __name__ == "__main__":
    main()
