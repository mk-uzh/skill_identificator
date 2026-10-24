# DevSkill pipeline

Data preparation for the master's thesis, organised as bronze / silver / gold.
The pipeline ends where the Next.js application begins: it writes
`data/snapshots/<project>/snapshot.json`, which the study interface reads.

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

1. `brz_gh_commits.py` — commits from the local clone. No network, no token.
2. `brz_gh_pulls.py` — pull requests, reviews, review comments. Token recommended.
3. `brz_ji_issues.py` — Jira issues, comments, changelog. Anonymous.
4. `brz_preview.py` — read-only overview, pseudonymised.

Silver, taxonomy and gold follow. Every run is resumable: objects already stored
are skipped.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env          # add GITHUB_TOKEN
cd notebooks && python brz_gh_commits.py
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

`brz_gh_commits` was run against the real Sakai clone: 1,578 commits in the
window 2025-01-01 to 2026-10-01, 97 % of them carrying a `SAK-` key and 98 % a
pull request number in the subject. `brz_gh_pulls` and `brz_ji_issues` are
written but have not yet been run against the live APIs.
