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

## How a level and a confidence come about

- **Per unit:** the model assigns a level (l1 to l4) and a verbatim quote for at most two competences. Never l5.
- **Per person and competence:** the level is the highest unit level that may count (`judgeable = yes`). No level depends on a number of units or tickets (design principle MR19, volume is not ability).
- **l5 is not assigned.** "Sets the approach for others" needs evidence that others adopted the approach. Commits and reviews rarely show that, and counting units would only measure volume. Persons are capped at l4. The scale keeps l5 so that participants can set it themselves.
- **Confidence** is computed in code from the quality of the evidence: the share of the person's own changes that were accepted after a human review, and the share of units that could be judged without restriction. The number of units does not enter.
- **Sensitivity** (`runs/{project}_sensitivity.json`) compares the result with variants that do count units (`min2_ge3`, stricter l4). The variants are an analysis of how much counting would change, not part of the result.
- **Texts** (rationale, level reason) are written by a second model call from the facts of the cell and checked in code (no level words, sentence limits). Failed checks lead to up to three tries, then a fallback text.
- **Re-scoring without a new classification:** `python score.py --project X` then `python make_assessments.py --project X`. Only changed cells need new texts.
- **Person cards** (counts, first and last activity, areas) come from the silver tables: `python people.py --project X`. No model is involved.
