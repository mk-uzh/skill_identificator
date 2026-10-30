"""Classify evidence units with an LLM (forced JSON schema, closed category list, verbatim quotes).

Usage:
  python gld_01_classify_units.py --provider mock      --split dev  --out runs/mock_dev.jsonl
  python gld_01_classify_units.py --provider anthropic --model <id> --split dev
  python gld_01_classify_units.py --provider openai    --model <id> --base-url <url> --split test

Keys come from ANTHROPIC_API_KEY / OPENAI_API_KEY. Every run writes a manifest next to the output
(model, prompt hash, input hash, schema hash, temperature, timestamp). Quotes are verified in code:
a quote that is not a substring of the unit text is flagged and the observation is dropped.
"""
import argparse, csv, hashlib, json, os, re, sys, time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "pipeline/src"))
from devskill.config import Config
CFG = Config()                       # project from DEVSKILL_PROJECT (default sakai)
DATA = CFG.data_root
SAMPLE = DATA / "silver/samples" / ("sample_n120_seed42" if CFG.project["name"] == "sakai" else "sample_n60_seed42")
PROMPT = ROOT / "pipeline/prompts/unit_classification_v2.md"
SCHEMA = ROOT / "pipeline/prompts/unit_schema.json"
TAX = ROOT / "model/taxonomy.v3.json"

norm = lambda s: re.sub(r"\s+", " ", s).strip()
sha = lambda b: hashlib.sha256(b if isinstance(b, bytes) else b.encode()).hexdigest()[:16]


def load_units():
    src = SAMPLE.with_suffix(".md").read_text(encoding="utf-8")
    parts = re.split(r"\n---\n\n(?=## \d+\. )", src)[1:]
    rows = list(csv.DictReader(SAMPLE.with_suffix(".csv").open(encoding="utf-8")))
    units = []
    for i, (p, r) in enumerate(zip(parts, rows), 1):
        a = p.index("```text\n") + 8
        b = p.rindex("\n```\n\n**What this person can do")
        units.append(dict(n=i, split="dev" if (i <= 60 or CFG.project["name"] != "sakai") else "test", evidence_id=r["evidence_id"],
                          role=r["role"], text=p[a:b]))
    return units


def call_anthropic(model, system, user, schema, temperature):
    import anthropic
    c = anthropic.Anthropic()
    tool = {"name": "record", "description": "Record the coding of this unit.", "input_schema": schema}
    m = c.messages.create(model=model, max_tokens=1500, temperature=temperature, system=system,
                          tools=[tool], tool_choice={"type": "tool", "name": "record"},
                          messages=[{"role": "user", "content": user}])
    return next(b.input for b in m.content if b.type == "tool_use")


def call_openai(model, system, user, schema, temperature, base_url=None):
    from openai import OpenAI
    c = OpenAI(base_url=base_url) if base_url else OpenAI()
    r = c.chat.completions.create(
        model=model, temperature=temperature,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_schema", "json_schema": {"name": "unit", "schema": schema, "strict": True}})
    return json.loads(r.choices[0].message.content)


def call_mock(unit):
    """Deterministic stand-in so the pipeline can be tested without a key. Not a model."""
    return {"judgeable": "no" if unit["role"] == "reviewer" and len(unit["text"]) < 400 else "limited",
            "observations": []}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", choices=["anthropic", "openai", "mock"], required=True)
    ap.add_argument("--model", default="")
    ap.add_argument("--base-url", default=None)
    ap.add_argument("--split", choices=["dev", "test", "all"], default="dev")
    ap.add_argument("--temperature", type=float, default=0.0)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    system = PROMPT.read_text(encoding="utf-8")
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    units = [u for u in load_units() if a.split in ("all", u["split"])]
    if a.limit:
        units = units[: a.limit]
    out = Path(a.out or DATA / f"gold/runs/{a.provider}_{a.model or 'na'}_{a.split}.jsonl")
    out.parent.mkdir(parents=True, exist_ok=True)

    n_bad = 0
    with out.open("w", encoding="utf-8") as fh:
        for u in units:
            user = f"Unit {u['n']} ({u['role']}). Evidence unit text:\n\n{u['text']}"
            for attempt in range(3):
                try:
                    if a.provider == "mock": res = call_mock(u)
                    elif a.provider == "anthropic": res = call_anthropic(a.model, system, user, schema, a.temperature)
                    else: res = call_openai(a.model, system, user, schema, a.temperature, a.base_url)
                    break
                except Exception as e:  # retry transient errors
                    print(f"unit {u['n']} attempt {attempt+1}: {e}", file=sys.stderr); time.sleep(2 ** attempt); res = None
            if res is None:
                fh.write(json.dumps({"unit": u["n"], "error": "failed"}) + "\n"); continue
            t = norm(u["text"]); kept = []
            for o in res.get("observations", []):
                ok = norm(o["quote"]) in t
                if ok: kept.append(o)
                else: n_bad += 1
            fh.write(json.dumps({"unit": u["n"], "evidence_id": u["evidence_id"], "role": u["role"],
                                 "judgeable": res.get("judgeable"), "observations": kept,
                                 "dropped_unverified_quotes": len(res.get("observations", [])) - len(kept)},
                                ensure_ascii=False) + "\n")
    manifest = dict(provider=a.provider, model=a.model, temperature=a.temperature, split=a.split,
                    n_units=len(units), unverified_quotes_dropped=n_bad,
                    prompt_sha=sha(system), schema_sha=sha(json.dumps(schema, sort_keys=True)),
                    taxonomy_sha=sha(TAX.read_bytes()), input_sha=sha("".join(u["text"] for u in units)),
                    timestamp=datetime.now(timezone.utc).isoformat())
    out.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print(f"{len(units)} units -> {out}; unverified quotes dropped: {n_bad}")


if __name__ == "__main__":
    main()
