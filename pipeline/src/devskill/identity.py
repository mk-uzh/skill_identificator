"""Merge author identities and pseudonymise them.

Principle: bronze keeps the raw fields. From here on everything works with
dev_id (DEV-01, DEV-02, ...) and a salted hash only. The mapping table stays
local and is never versioned.
"""
from __future__ import annotations
import hashlib, json, os, secrets
from collections import Counter, defaultdict
from pathlib import Path

BOT_PATTERNS = ("[bot]", "dependabot", "renovate", "github-actions", "copilot")


def _salt(pipeline_root: Path, data_dir: Path | None = None) -> str:
    """Salt from the environment, otherwise generated once and stored locally."""
    s = os.environ.get("DEVSKILL_SALT")
    if s:
        return s
    f = (data_dir or pipeline_root / "data") / ".salt"
    if f.exists():
        return f.read_text(encoding="utf-8").strip()
    s = secrets.token_hex(16)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(s, encoding="utf-8")
    return s


def _labels():
    """DEV-01, DEV-02, ... assigned in descending order of commit count."""
    n = 1
    while True:
        yield f"DEV-{n:02d}"
        n += 1


def is_bot(name: str, email: str) -> bool:
    t = f"{name} {email}".lower()
    return any(m in t for m in BOT_PATTERNS)


def build(pairs, pipeline_root: Path, data_dir: Path | None = None):
    """pairs: iterable of (name, email) per commit, repetitions included.

    Returns (mapping, people):
      mapping[(name_lower, email_lower)] = dev_id
      people[dev_id] = {dev_id, dev_hash, names, emails, n_commits, is_bot}
    """
    pairs = [(n or "", e or "") for n, e in pairs]
    parent: dict[str, str] = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for n, e in pairs:
        union("n:" + n.lower(), "e:" + e.lower())

    counts = Counter(find("n:" + n.lower()) for n, e in pairs)
    names = defaultdict(set)
    emails = defaultdict(set)
    for n, e in pairs:
        r = find("n:" + n.lower())
        names[r].add(n)
        emails[r].add(e)

    salt = _salt(pipeline_root, data_dir)
    label = _labels()
    people, mapping = {}, {}
    for root, n_commits in counts.most_common():
        bot = any(is_bot(x, "") for x in names[root]) or \
              any(is_bot("", x) for x in emails[root])
        dev_id = next(label)
        primary = sorted(emails[root])[0]
        people[dev_id] = {
            "dev_id": dev_id,
            "dev_hash": hashlib.sha256((salt + primary.lower()).encode()).hexdigest()[:16],
            "names": sorted(names[root]),
            "emails": sorted(emails[root]),
            "n_commits": n_commits,
            "is_bot": bot,
        }
        for n, e in pairs:
            if find("n:" + n.lower()) == root:
                mapping[(n.lower(), e.lower())] = dev_id
    return mapping, people


def write_mapping(people: dict, path: Path) -> Path:
    """Local mapping file holding real names. Must NOT be versioned."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(
        {"note": "Contains real names. Never commit, never share.",
         "people": list(people.values())},
        ensure_ascii=False, indent=2), encoding="utf-8")
    return path
