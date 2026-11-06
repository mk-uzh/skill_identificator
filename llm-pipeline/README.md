# llm-pipeline

Classify evidence units, score in code, then write an assessments candidate for the study tool.

Inputs: `docs/evidence/` and `docs/silver/`. API key in `.env` (never committed).

## Setup

```bash
cd llm-pipeline
pip install -r requirements.txt
cp .env.example .env   # set ANTHROPIC_API_KEY
```

## Run

```bash
python classify.py --project nifi --limit 50
python classify.py --project sakai --limit 120
```

That draws a seeded stratified sample across all study people and both roles, classifies, scores, and writes `runs/{project}_assessments.candidate.json`.


## Outputs

| File | Meaning |
|---|---|
| `runs/{project}.jsonl` | Classification per unit |
| `runs/{project}_sample.csv` | Units drawn for this run |
| `runs/{project}_profiles.json` | Level and confidence per person × competence |
| `runs/{project}_assessments.candidate.json` | Study file draft |
| `runs/{project}_sensitivity.json` | Level changes across scoring variants |

