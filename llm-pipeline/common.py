"""Shared helpers for the scripts in this folder."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path

import yaml
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
RUNS = HERE / "runs"

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# Person @handles in prose (lowercase). Does not match Java annotations (@Test, @Override).
HANDLE = re.compile(r"(?<![\w/])@[a-z][a-z0-9-]{1,38}\b")

# Forbidden in Task-1 text (what_records_show / rationale).
LEVEL_WORDS = re.compile(
    r"\b("
    r"l[1-5]|level\s*[1-5]|not[\s_-]*observable|n/o|"
    r"routine|mechanical|cosmetic|autonomy|complexity|influence|"
    r"follows a given|completes routine|solves and explains|others rely|sets the approach"
    r")\b",
    re.IGNORECASE,
)

# Forbidden in Task-2 polished level_reason (codes / internal jargon).
INTERNAL_LEVEL_JARGON = re.compile(
    r"\b("
    r"l[1-5]|l3[a-c]|not\s*l[1-5]|n/o|"
    r"clipped|borderline|judgeable|what_records_show|"
    r"thin l4|min_support|peak=|level_rule"
    r")\b",
    re.IGNORECASE,
)

LEVEL_NUM = {"l1": 1, "l2": 2, "l3": 3, "l4": 4, "l5": 5}
NUM_LEVEL = {v: k for k, v in LEVEL_NUM.items()}

# Study-facing names (same wording as the study tool).
LEVEL_LABELS = {
    "l1": "Follows a given approach",
    "l2": "Completes routine tasks alone",
    "l3": "Solves and explains the cause",
    "l4": "Others rely on it",
    "l5": "Sets the approach for others",
    "not_observable": "Not observable",
}


def sha16(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()[:16]


def has_level_words(text: str) -> bool:
    return bool(LEVEL_WORDS.search(text or ""))


def has_internal_jargon(text: str) -> bool:
    return bool(INTERNAL_LEVEL_JARGON.search(text or ""))


def load_env() -> None:
    load_dotenv(HERE / ".env")


def load_config() -> dict:
    with open(HERE / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def project_cfg(cfg: dict, project: str) -> dict:
    if project not in cfg["projects"]:
        raise SystemExit(f"Unknown project {project!r}. Use: {', '.join(cfg['projects'])}")
    return cfg["projects"][project]


def evidence_csv(project: str) -> Path:
    return REPO / "docs" / "evidence" / f"{project}_evidence_units.csv"


def silver_dir(project: str) -> Path:
    return REPO / "docs" / "silver" / project


def taxonomy_path() -> Path:
    return REPO / "model" / "taxonomy.json"


def taxonomy_version() -> str:
    data = json.loads(taxonomy_path().read_text(encoding="utf-8"))
    return data["taxonomy_version"]


def ensure_runs() -> Path:
    RUNS.mkdir(parents=True, exist_ok=True)
    return RUNS


def run_jsonl(project: str) -> Path:
    return ensure_runs() / f"{project}.jsonl"


def classify_manifest_path(project: str) -> Path:
    return ensure_runs() / f"{project}_classify_manifest.json"


def sensitivity_path(project: str) -> Path:
    return ensure_runs() / f"{project}_sensitivity.json"


def profiles_path(project: str) -> Path:
    return ensure_runs() / f"{project}_profiles.json"


def texts_cache_path(project: str) -> Path:
    return ensure_runs() / f"{project}_text_cache.json"


def sample_csv_path(project: str) -> Path:
    return ensure_runs() / f"{project}_sample.csv"


def estimate_cost_usd(usage: dict, pricing: dict) -> float:
    """Rough USD from token counts and config pricing (per million tokens)."""
    inp = usage.get("input_tokens", 0) or 0
    out = usage.get("output_tokens", 0) or 0
    cwrite = usage.get("cache_creation_input_tokens", 0) or 0
    cread = usage.get("cache_read_input_tokens", 0) or 0
    return round(
        inp * pricing.get("input_per_mtok", 0) / 1_000_000
        + out * pricing.get("output_per_mtok", 0) / 1_000_000
        + cwrite * pricing.get("cache_write_per_mtok", 0) / 1_000_000
        + cread * pricing.get("cache_read_per_mtok", 0) / 1_000_000,
        6,
    )


def candidate_path(project: str) -> Path:
    return ensure_runs() / f"{project}_assessments.candidate.json"


def study_assessments_path(project: str) -> Path:
    name = "assessments.json" if project == "sakai" else f"assessments.{project}.json"
    return REPO / "study-data" / name


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def has_privacy_leak(text: str) -> bool:
    return bool(EMAIL.search(text or "") or HANDLE.search(text or ""))


def load_done_ids(path: Path) -> set[str]:
    if not path.exists():
        return set()
    done = set()
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            if "evidence_id" in row and "error" not in row:
                done.add(row["evidence_id"])
    return done


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows
