# DevSkill pipeline

Data preparation for the master's thesis, organised as bronze / silver / gold.
The pipeline ends where the Next.js application begins: gold writes
`study-data/assessments.json`, which the study interface reads unchanged.

## Layers

| Layer | Content | Tables |
|---|---|---|
| Bronze | raw data, unchanged, with fetch timestamp | `brz_*` |
| Silver | normalised, identities merged, keys resolved | `slv_*` |
| Gold | classification, profiles, frozen snapshots | `gld_*` |

Filtering never deletes rows; it sets flags (`in_window`, `in_scope`, `is_bot`),
so a sensitivity analysis stays possible.

## Naming

* Notebooks: `<layer>_<topic>.py`, layer in `brz`, `slv`, `tax`, `gld`, `llm`, `eva`.
  Within bronze the order is free, so no numbering; from silver on the notebooks
  are numbered because the order matters.
* Tables: `brz_<source>_<object>`, from silver on without the source
  (`slv_commit`, `gld_skill_profile`).
* Columns: lower case with underscores, `*_id` surrogate keys, `*_key` natural
  keys, `*_at` UTC timestamps, `is_`/`has_` booleans, `n_` counts.

## Order

Bronze (order is free, every run is resumable):

1. `brz_gh_commits.py` — commits from the local clone. No network, no token.
2. `brz_gh_pulls.py` — pull requests, reviews, review comments. Token recommended.
3. `brz_ji_issues.py` — Jira issues, comments, changelog. Anonymous.
4. `brz_preview.py` — read-only overview, pseudonymised.

Silver (the order matters):

5. `slv_01_entities.py` — merges identities, resolves keys, writes the `tbl_slv_*` tables (schema in `sql/01_silver.sql`).
6. `slv_02_dataprofile.py` — writes `data/silver/data_profile.html`: what the data can and cannot show.
7. `slv_03_evidence_units.py` — one evidence unit per person, issue and role (`author` or `reviewer`), as a text block capped at 12,000 characters. E-mail addresses and `@handles` are removed before the text can reach a model. Rebuilds the table on every run.
8. `slv_04_sample_units.py` — seeded draw of evidence units for coding by hand, stratified by role. `py pipeline/notebooks/slv/slv_04_sample_units.py --n 120` writes a readable `.md` and the drawn ids as `.csv` into `data/silver/samples/`. The sample becomes the goldstandard, so keep the files of the final draw.

Taxonomy and gold are not built yet:

* code about 120 units openly, without a list; group; only then compare with ESCO
* fix about 100 units as goldstandard before any model sees them
* classification: one call per unit, forced JSON schema, closed category list, raw results with model id, prompt version, input hash and timestamp
* check against the goldstandard (Cohen's kappa) before building further
* scoring in code, not in the model; confidence from the evidence
* freeze, write `study-data/assessments.json`

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env          # add GITHUB_TOKEN
py notebooks/brz/brz_gh_commits.py     # from the pipeline/ folder; on Linux or macOS use python
```

All parameters live in `conf/params.yaml` — observation window, project,
thresholds, model name. No notebook carries parameters of its own.

## Privacy

Bronze holds the raw author names and e-mail addresses because identities can
only be merged with them. Bronze, the identity mapping and the local clone never
leave the machine and are excluded from version control. Everything downstream
uses `DEV-01`, `DEV-02`, ... and a salted hash. Because published artefacts keep
commit SHAs for reproducibility, this is pseudonymisation, not anonymisation.

## Verification status

`brz_gh_commits` was run against the real Sakai clone: 1,578 commits in the window
2025-01-01 to 2026-10-01, 97 % of them carrying a `SAK-` key and 98 % a pull request
number in the subject. Pull requests, reviews and Jira issues are loaded and silver is
built on them. `slv_03` and `slv_04` run from any working directory (they locate
`pipeline/` from the file); the older notebooks must be run from PyCharm.

## Several projects

The pipeline runs on one project at a time. The project is chosen with the environment
variable `DEVSKILL_PROJECT`; without it `conf/params.yaml` (sakai) is used, so existing
runs stay as they are.

| Project | Config | Local data |
|---|---|---|
| sakai (default) | `conf/params.yaml` | `data/` |
| nifi | `conf/nifi.yaml` | `data/nifi/` (bronze, silver, mapping.secrets.json, .salt, samples) |

PowerShell, from `pipeline/`:

```powershell
$env:DEVSKILL_PROJECT = "nifi"
py notebooks/brz/brz_gh_commits.py
py notebooks/brz/brz_gh_patches.py
py notebooks/brz/brz_gh_pulls.py      # needs GITHUB_TOKEN in .env, runs for hours, resumable
py notebooks/brz/brz_ji_issues.py     # anonymous, issues.apache.org
py notebooks/slv/slv_01_entities.py
py notebooks/slv/slv_03_evidence_units.py
```

Each project keeps its own `mapping.secrets.json` and `.salt`, so DEV-01 in sakai and DEV-01
in nifi are different people. Never share one mapping file between projects.
