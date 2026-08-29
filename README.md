# DevSkill – Case Study Prototype

Web application for the experimental case study on the team skill matrix:
**Task 1** (assessment without support) and **Task 2** (assessment with AI
suggestions, including a complete interaction log).

Stack: Next.js 14 (App Router) · React 18 · TypeScript · file-based persistence.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # set STUDY_ADMIN_TOKEN
npm run dev
```

Then open `http://localhost:3000`.

---

## Participant flow

| Route    | Content                                                            |
| -------- | ------------------------------------------------------------------ |
| `/`      | Introduction, participant code, consent                             |
| `/task1` | Empty matrix, no support                                            |
| `/task2` | Matrix pre-filled with task 1 values, AI suggestions per cell        |
| `/done`  | Short questionnaire (trust, confidence, usefulness)                  |

Clicking a developer name opens a short profile with the evidence the
assessment should be based on.

---

## Where the data lives

```
data/
  sessions/<sessionId>.json   results: task 1, task 2, suggestions, decisions, questionnaire
  events/<sessionId>.jsonl    complete interaction log, one line per event
```

The directory is excluded in `.gitignore`. A different path can be set via
`STUDY_DATA_DIR` (e.g. a persistent volume when hosting).

**Switching to a database:** all reads and writes go exclusively through
`src/lib/store.ts`. For Supabase, Postgres or SQLite it is enough to replace the
functions there – the API routes stay the same.

### Recorded events

`session_start`, `task_start`, `cell_open`, `cell_change`, `suggestion_shown`,
`suggestion_accept`, `suggestion_dismiss`, `suggestion_modify`, `profile_open`,
`profile_close`, `window_blur`, `window_focus`, `task_submit`, `survey_submit`

Every event carries a timestamp, milliseconds since task start, the cell as well
as the old and new value. Events are sent in batches every four seconds and are
flushed via `sendBeacon` when the tab is closed.

---

## Export for the analysis

```
GET /api/export?token=<STUDY_ADMIN_TOKEN>&type=ratings       # one row per cell and task
GET /api/export?token=<STUDY_ADMIN_TOKEN>&type=suggestions   # one row per suggestion incl. decision
GET /api/export?token=<STUDY_ADMIN_TOKEN>&type=sessions      # overview incl. questionnaire
GET /api/export?token=<STUDY_ADMIN_TOKEN>&type=events        # complete log
GET /api/export?token=<STUDY_ADMIN_TOKEN>&type=raw           # everything as JSON
```

The CSV files are in long format and can be read directly into R, SPSS or
pandas. `suggestions.csv` already contains the columns `followedSuggestion`
(0/1), `veracity` (`correct` / `incorrect`) and `timeToDecisionMs` – which makes
automation bias directly analysable: the share of accepted suggestions for
deliberately wrong versus correct suggestions.

---

## Adapting the study design

All content-level knobs live in **`src/lib/study-config.ts`**:

- `CATEGORIES` – competence categories (columns)
- `DEVELOPERS` – profiles and evidence (rows)
- `SCRIPTED_SUGGESTIONS` – which cells receive a suggestion, in which direction
  it deviates, with which confidence and whether it is correct or wrong by
  design
- `SHOW_CONFIDENCE`, `SHOW_RATIONALE` – whether confidence value and rationale
  are displayed (possible manipulation for a second condition)

The suggestions are deliberately **scripted and not random**: only this way is
it controllable which suggestions are correct and which are deliberately wrong.
The concrete target value is computed in `src/lib/suggestions.ts` relative to
the participant's task 1 input, so that every suggestion visibly deviates from
their own rating.

---

## Deployment

On Vercel and similar serverless platforms the file system is **ephemeral** –
file-based storage only works there for local testing. For a data collection
with real participants either

- run it on a server or container with a persistent volume (point
  `STUDY_DATA_DIR` at the volume), or
- switch `src/lib/store.ts` to Supabase/Postgres.

---

## Open points

- [ ] Finalise the content of the developer profiles and evidence
- [ ] Define which suggestions count as correct or wrong (ground truth)
- [ ] Check order effects: task 1 always before task 2 (within-subjects)
- [ ] Pretest with 2–3 people, then review the time budget
- [ ] Align the ethics/data protection wording with the supervisor
