# Evidence units (pseudonymised export)

One CSV per project, one row per evidence unit: `sakai_evidence_units.csv` (3,000 units),
`nifi_evidence_units.csv` (3,387 units). Written by `pipeline/notebooks/slv/slv_05_export_units.py`
from the silver tables of `pipeline/data/<project>/silver/silver.sqlite`.

**Pseudonymised, not anonymous.** People are `DEV-nn`. E-mail addresses, `@handles`, Jira mentions,
GitHub profile URLs and the names of the identified developers are removed. Names in free text that are
not in the identity mapping can remain, and commit and ticket texts are public and searchable. The
identity mapping and the salt are not part of this repository. Do not pass the files on.

## Columns

| Column | Meaning |
|---|---|
| `evidence_id` | `<dev_id>:<role>:<issue_key>`, e.g. `DEV-02:reviewer:NIFI-14706` |
| `project` | `sakai` or `nifi` |
| `dev_id` | pseudonym of the person |
| `role` | `author` (made commits for the issue) or `reviewer` (reviewed a pull request for the issue) |
| `issue_key` | Jira issue; links commits, pull requests and Jira |
| `n_commits`, `n_files` | size of the person's change (0 for reviewers) |
| `n_chars` | length of `text` before scrubbing |
| `has_code`, `has_review` | 1 if the unit contains code the person added / a recorded human review |
| `text` | the unit, see below |

## What `text` contains

Sections, in this order, when present. Source in brackets.

* `## The task` — issue type, status, title and description (Jira). Context only, not evidence of skill.
* `## What this person changed` — commit messages (GitHub)
* `## Files touched`, `## Code they added` — file list with language and layer, added lines (GitHub patches)
* `## How the work was received` — count of review verdicts on the person's pull request (GitHub)
* `## Their verdict`, `## What they pointed at in the code` — a reviewer's verdicts and line comments (GitHub)
* `## What they wrote in the discussion` — the person's own Jira comments

A unit is capped at 12,000 characters. Long parts are cut and marked `[...clipped]`.

## Example

`DEV-01:reviewer:NIFI-10752` (reviewer unit, short): task title and description from Jira, one
verdict `COMMENTED`, and one line comment on `pom.xml:31`. Reviewer units that hold only a verdict
(`APPROVED`) say nothing about a skill and are coded "not observable".

Taxonomy and coding rules: `docs/CODEBOOK.md`.
