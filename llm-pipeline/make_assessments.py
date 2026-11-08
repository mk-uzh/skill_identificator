"""Build assessments.json for the study tool from scored profiles."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone

from collections import defaultdict

from common import (
    candidate_path,
    load_config,
    profiles_path,
    project_cfg,
    read_csv,
    silver_dir,
    taxonomy_version,
)

SKILL_LEVELS = {"l1", "l2", "l3", "l4", "l5", "not_observable"}
EVIDENCE_KINDS = {"commit", "pull_request", "review", "issue"}


_SHA = re.compile(r"/commit/([0-9a-f]{40})")
_PULL = re.compile(r"/pull/(\d+)")
MAX_LABELLED = 6


def involvement_index(project: str) -> dict:
    """Who else worked on an issue, from silver only: commit authors, PR authors, reviewers."""
    d = silver_dir(project)
    commits = [c for c in read_csv(d / "slv_commit.csv") if c.get("is_merge", "0") != "1"]
    prs = read_csv(d / "slv_pull_request.csv")
    reviews = [r for r in read_csv(d / "slv_review.csv") if r.get("is_bot") != "1"]
    pr_issue = {str(p["pr_number"]): p.get("issue_key") for p in prs}
    people: dict[str, dict[str, set]] = defaultdict(lambda: defaultdict(set))
    for c in commits:
        if c.get("issue_key") and c.get("dev_id"):
            people[c["issue_key"]][c["dev_id"]].add("author")
    for p in prs:
        if p.get("issue_key") and p.get("author_dev_id"):
            people[p["issue_key"]][p["author_dev_id"]].add("author")
    for r in reviews:
        issue = pr_issue.get(str(r.get("pr_number")))
        if issue and r.get("reviewer_dev_id"):
            people[issue][r["reviewer_dev_id"]].add("reviewer")
    return {
        "people": people,
        "sha_issue": {c["sha"]: c.get("issue_key") for c in commits},
        "pr_issue": pr_issue,
    }


def involved_for(url: str, own_dev: str, ix: dict, study: set) -> list[dict]:
    """Other people on the same issue. Study people carry their label, all others are anonymous."""
    m = _SHA.search(url)
    issue = ix["sha_issue"].get(m.group(1)) if m else None
    if not issue:
        m = _PULL.search(url)
        issue = ix["pr_issue"].get(m.group(1)) if m else None
    if not issue:
        return []
    out = []
    for dev, roles in sorted(ix["people"].get(issue, {}).items()):
        if dev == own_dev:
            continue
        role = "author" if "author" in roles else "reviewer"
        row = {"role": role}
        if dev in study:
            row["label"] = dev
        out.append(row)
    out.sort(key=lambda r: (r.get("label") is None, r.get("label") or "", r["role"]))
    return out[:MAX_LABELLED + 4]


def clean_evidence(items: list, own_dev: str = "", ix: dict | None = None, study: set | None = None) -> list[dict]:
    """Drop epoch placeholder dates; keep real timestamps and optional notes."""
    out = []
    for e in items or []:
        row = {
            "kind": e["kind"],
            "title": e["title"],
            "url": e["url"],
        }
        ts = e.get("timestamp")
        if ts and str(ts).strip() and not str(ts).startswith("1970-01-01"):
            row["timestamp"] = ts
        note = (e.get("note") or "").strip()
        if note:
            row["note"] = note[:300]
        if ix is not None:
            inv = involved_for(e["url"], own_dev, ix, study or set())
            if inv:
                row["involved"] = inv
        out.append(row)
    return out


def config_hash(assessments: list) -> str:
    blob = json.dumps(assessments, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(blob).hexdigest()[:16]


def validate(file_obj: dict) -> None:
    for key in ("taxonomy_version", "organization_id", "computed_at", "config_hash", "assessments"):
        if key not in file_obj:
            raise SystemExit(f"missing top-level field: {key}")
    seen = set()
    for i, a in enumerate(file_obj["assessments"]):
        label = f"assessments[{i}]"
        for k in ("id", "developer_id", "category_id", "level", "confidence", "rationale", "evidence"):
            if k not in a:
                raise SystemExit(f"{label} missing {k}")
        if a["level"] not in SKILL_LEVELS:
            raise SystemExit(f"{label} bad level {a['level']!r}")
        if not isinstance(a["confidence"], (int, float)) or not (0 <= a["confidence"] <= 1):
            raise SystemExit(f"{label} confidence must be 0..1")
        if not a["rationale"].strip():
            raise SystemExit(f"{label} empty rationale")
        if not isinstance(a["evidence"], list):
            raise SystemExit(f"{label} evidence must be a list")
        pair = (a["developer_id"], a["category_id"])
        if pair in seen:
            raise SystemExit(f"duplicate {pair}")
        seen.add(pair)
        for j, e in enumerate(a["evidence"]):
            if e.get("kind") not in EVIDENCE_KINDS:
                raise SystemExit(f"{label}.evidence[{j}] bad kind")
            for ek in ("title", "url"):
                if not e.get(ek):
                    raise SystemExit(f"{label}.evidence[{j}] missing {ek}")
            for k, inv in enumerate(e.get("involved") or []):
                if inv.get("role") not in ("author", "reviewer"):
                    raise SystemExit(f"{label}.evidence[{j}].involved[{k}] bad role")
            ts = e.get("timestamp")
            if ts is not None and (
                not str(ts).strip() or str(ts).startswith("1970-01-01")
            ):
                raise SystemExit(
                    f"{label}.evidence[{j}] omit placeholder/epoch timestamps"
                )


def main() -> None:
    ap = argparse.ArgumentParser(description="Write assessments candidate from profiles")
    ap.add_argument("--project", required=True, choices=["sakai", "nifi"])
    args = ap.parse_args()

    cfg = load_config()
    proj = project_cfg(cfg, args.project)
    src = profiles_path(args.project)
    if not src.exists():
        raise SystemExit(f"Missing {src}. Run score.py first.")

    data = json.loads(src.read_text(encoding="utf-8"))
    profiles = data["profiles"]
    allow = set(cfg["study_developers"])
    inv_ix = involvement_index(args.project)

    assessments = []
    for p in profiles:
        if p["developer_id"] not in allow:
            continue
        assessments.append(
            {
                "id": f"assess-{p['developer_id']}-{p['category_id']}",
                "developer_id": p["developer_id"],
                "category_id": p["category_id"],
                "level": p["level"],
                "confidence": p["confidence"],
                "rationale": p["rationale"],
                "level_reason": p["level_reason"],
                "blind_spots": p["blind_spots"],
                "evidence": clean_evidence(p.get("evidence") or [], p["developer_id"], inv_ix, allow),
            }
        )

    have = {(a["developer_id"], a["category_id"]) for a in assessments}
    for dev in cfg["study_developers"]:
        for cat in cfg["competences"]:
            if (dev, cat) in have:
                continue
            assessments.append(
                {
                    "id": f"assess-{dev}-{cat}",
                    "developer_id": dev,
                    "category_id": cat,
                    "level": "not_observable",
                    "confidence": 0.9,
                    "rationale": (
                        f"These records show nothing about {cat.replace('_', ' ')}. "
                        "There are no coded units for this competence."
                    ),
                    "level_reason": (
                        "Not observable: no unit showed this competence "
                        "in what the person wrote or did."
                    ),
                    "blind_spots": (
                        "The public records simply do not mention this competence "
                        "for this person."
                    ),
                    "evidence": [],
                }
            )

    assessments.sort(key=lambda a: (a["developer_id"], a["category_id"]))
    out_obj = {
        "taxonomy_version": taxonomy_version(),
        "organization_id": proj["organization_id"],
        "computed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "config_hash": config_hash(assessments),
        "generated_by": "llm-pipeline/make_assessments.py",
        "data_status": "PIPELINE",
        "assessments": assessments,
    }
    validate(out_obj)

    dest = candidate_path(args.project)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out_obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{args.project}: {len(assessments)} assessments -> {dest}")


if __name__ == "__main__":
    main()
