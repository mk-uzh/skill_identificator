# Design principle traceability (Spec §10)

Chapter 5 of the thesis documents, per principle, how it was realised and where it was weakened.

## Checklist

| DP | Principle | Realised by | Status |
|---|---|---|---|
| DP1 | Evidential transparency | Evidence popover on every Task-2 cell: one-sentence rationale, contributing signals, and concrete evidence items from `data/assessments.json` as working links. Path: click suggested value or “Evidence & rationale” → click artifact link (two clicks). | [x] |
| DP2 | Anchored and calibrated scales | Level anchors in `src/lib/org-config.ts` (`ORG_CONFIG.level_anchors`), shown in the legend; confidence % per Task-2 cell. | [x] |
| DP3 | Suggestion under human decision | Accept / adjust / reject on every cell; no auto-assignment; banner states the final decision rests with the user. Untouched cells at submit are treated as implicit accept of the pre-filled suggestion (still a human submit). | [x] |
| DP4 | Contestability and correction | Free-text correction note per cell in the evidence popover; persisted on the section-6 interaction row as `correction_note`. | [x] |
| DP5 | Separation from personnel processes | Permanent `StudyBanner` on every page; default visibility `lead_only`; pseudonymous participant / developer ids; local file storage (no cloud HR system). | [x] |
| DP6 | Declared visibility regime | `ORG_CONFIG.visibility` ∈ {`lead_only`, `team_visible`, `self_only_plus_lead`}, default `lead_only`; active setting shown on the coverage panel; self-view policy stated for every setting. | [x] |
| DP7 | Declared scope and blind spots | Coverage panel permanently on Screen 2: sources (GitHub, Jira), observation window, plain-language blind spots (soft skills, untraced mentoring/review, work outside tracked systems). No volume or lead-time metrics in the UI. | [x] |
| DP8 | Derivation instead of maintenance | `npm run infer` recomputes `data/assessments.json` from snapshot + taxonomy; UI never edits inferred values; file is replaced, not hand-maintained. | [x] |
| DP9 | Discipline-level adaptable taxonomy | Six display categories at discipline level (backend, frontend, DevOps, testing, data, security) in study config / assessments contract. | [x] |
| DP10 | Embedding in the decision environment | Out of MVP scope | [ ] deferred |
| DP11 | Attribution under AI assistance | Documented for the future Artifact model (`ai_assisted` flag); not used in scoring while the MVP runs on scripted assessments. | [x] |

## Where principles were weakened

| DP | Weakening | Why |
|---|---|---|
| DP1 | Artifact URLs point at plausible but synthetic `example-org` / `jira.example.org` hosts until real ingestion (M4) lands. Links are structurally correct and openable; they are not live partner data. | Thesis needs a demonstrable instrument before accurate inference; fake-data rules in Spec §9. |
| DP1 | Contributing “signals” are derived from evidence kinds in the UI layer (`signalsFromEvidence`), not yet produced by `infer/`. | Inference engine is M5; contract is the assessments file. |
| DP2 | Anchors live in `ORG_CONFIG`, not yet in a versioned ESCO taxonomy YAML with concept layer. | Full taxonomy config is tied to M5 / partner freeze (Spec §11 Q1). |
| DP3 | On Task-2 submit, cells still at the suggested level with no explicit Accept are logged as `accepted_unchanged`. | Avoids blocking finish; still requires an explicit task submit (no silent auto-write to a system of record). |
| DP4 | Correction notes are stored with the research log; there is no workflow that routes objections back to the inferred file or to a team process. | Contestation for the study instrument; write-back is out of MVP scope. |
| DP5 | “Local processing” is local/dev file storage; production hosting for the three partner orgs is not yet fixed (Spec §11 Q4). | Deployment is M6. |
| DP6 | Visibility is **declared and displayed**, but role-based enforcement (lead vs team vs self login) is not implemented — the study UI is lead/PM-facing only. Self-view is stated as policy text, not a separate authenticated developer view. | Auth beyond a shared study login is out of MVP (Spec §1). |
| DP7 | Blind spots are static org-config copy, not computed from a real snapshot coverage report. | Snapshot ingestion is M4. |
| DP8 | Live partner snapshots are not yet connected; the demo snapshot is frozen. Recompute is wired (`npm run infer`) but depends on ingest freshness. | Partner ingest is organization-specific (M6). |
| DP9 | No per-organization taxonomy variants yet; one demo taxonomy for all. | Partner category freeze pending (Spec §11 Q1). |
| DP10 | Not implemented. | Explicitly out of MVP. |
| DP11 | No `ai_assisted` Artifact flag in the running MVP data path. | Flag belongs with ingest/Artifact model (M4+); excluded from scoring until validated. |
