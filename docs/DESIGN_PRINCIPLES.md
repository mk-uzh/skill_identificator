# Traceability: meta-requirements, design principles and what the prototype does

Chapter 5 of the thesis documents, per principle, how it was realised and where it was weakened. Status: **yes** = implemented in the study tool, **partly** = implemented in part, **no** = not implemented (reason given), **planned** = depends on the gold layer, which is not built yet.

The meta-requirements (MR) are the result of the expert interviews. They are kept in full: a requirement that is not built stays in the list, with the reason, so that the link back to the interviews is not lost.

## Meta-requirements

| MR | Requirement (short) | Status | Where / why |
|---|---|---|---|
| MR1 | Per developer: components, repositories, issue areas | partly | Evidence units carry module and area. The tool shows it as text only; a "works mostly in" line per person is the realistic step. |
| MR2 | Quality signals, not only activity | partly | Review outcome (accepted, rework asked) is part of the evidence units. Defect density is not. |
| MR3 | Every value linked to its artefacts | yes | Evidence list with date and link in Task 1 and Task 2. Links in the demo data are placeholders until the gold layer runs. |
| MR4 | Natural-language explanation | yes | Text on what the records show, and in Task 2 the card "Why the system proposes this" (`level_reason`). |
| MR5 | Each level has a stated meaning, defined beforehand | yes | Five levels with behaviour-based names and anchors in `model/taxonomy.json`, `docs/CODEBOOK.md`; level guide in the tool. |
| MR6 | Confidence on top of a level | yes | Every Task-2 proposal shows a level and a confidence; "not observable" where the records are silent. |
| MR7 | Skills at discipline level, not technology level | yes | 12 competences at discipline level. The former "JavaScript" competence is now "frontend logic". |
| MR8 | Taxonomy adaptable by the organisation | partly | One file, `model/taxonomy.json`, is the single source. No interface and no per-organisation variants. |
| MR9 | Which skills build on which, next step | no | Small basis in the interviews (n = 3); needs a model of skill dependencies. Out of scope. |
| MR10 | Suggestion a human accepts, adjusts or rejects | yes | Accept, adjust or keep own answer, each logged. |
| MR11 | Contest and correct, recorded | yes | Free-text "Why?" per cell, stored in the interaction log. The correction does not feed back into the profile. |
| MR12 | Visibility by role, documented; person sees own values | partly | Visibility is a declared setting, shown under "Who can see this", and asked in the closing questionnaire. No login, no role enforcement, no self-view. The interviews do not agree on who may see what (F1 to F3). |
| MR13 | Recompute on demand, not maintained by hand | partly | The result file is generated, never edited by hand, and runs only when started (no continuous monitoring, see E1). The real gold layer is planned. |
| MR14 | Declare sources and blind spots | yes | "Covered" / "Not covered" panels, blind spot per cell; the blind spots now include that AI assistance is not visible. |
| MR15 | Record whether AI assisted | partly | The pipeline flags commits that name an AI tool (`is_ai_assisted`, 35 in Sakai, 6 in NiFi). The flag is not shown in the tool, and AI use without such a marker is not visible. Stated as a blind spot. No design principle was derived from it. |
| MR16 | Support development and rotation decisions | no | Out of scope. The occupation block on the summary page is a first hint only. |
| MR17 | Available inside the decision tools | no | Stand-alone web app. Out of scope. |
| MR18 | Validate against an independent reference | planned | Agreement check against a reference set coded by the researcher. Not done yet. |
| MR19 | No volume or lead time as ability | yes | Stated as a blind spot; counts appear only as context. |
| MR20 | Separate from performance review, and say so | yes | Permanent banner, pseudonyms, no write to any personnel system. |
| MR21 | Minimal processing, restricted access, data stays in jurisdiction | partly | Public data only, names and e-mail addresses removed, pseudonyms in the tool, local storage. The classification calls an external model API, so for real organisations a model in their own jurisdiction is needed. |
| MR22 | Measures chosen so that optimising does not degrade work | no | Discussed in the thesis, not built. |
| MR23 | Compare heterogeneous systems only where comparable | no | Not part of the artefact. The two projects are assessed separately and never compared in the tool. |
| MR24 | Useful as teams grow; user need not know every person | partly | Participants assess people they do not know; two projects are tested. Larger teams are not tested. |

## Design principles

| DP | Principle | Derived from | Status | Realised by |
|---|---|---|---|---|
| DP1 | Evidential transparency | MR3, MR4 | yes | Same evidence list in both tasks, with working links; text on what the records show; in Task 2 the card "Why the system proposes this". |
| DP2 | Anchored and calibrated scales | MR5, MR6 | yes | Level anchors taken from the taxonomy (one wording), level guide and confidence guide in the tool; confidence shown per cell. |
| DP3 | Suggestion under human decision | MR10 | yes | Accept, adjust or keep; no automatic assignment; banner states the decision rests with the person. |
| DP4 | Contestability and correction | MR11 | yes | Free-text note per cell, stored with the interaction log. |
| DP5 | Separation from personnel processes | MR20, MR21 | yes | Permanent banner, pseudonymous participant and developer ids, local file storage. |
| DP6 | Declared visibility regime | MR12 | partly | Setting `ORG_CONFIG.visibility` (lead only, team visible, self and lead), shown under "Who can see this". Not enforced. |
| DP7 | Declared scope and blind spots | MR14, MR19, MR23 | yes | Covered / Not covered panels, blind spot per cell, no volume or lead-time measures as ability. |
| DP8 | Derivation instead of maintenance | MR13 | partly | The result file is generated and replaced, never edited; the real pipeline (gold layer) is planned. |
| DP9 | Discipline-level and adaptable taxonomy | MR7, MR8, MR9 | partly | 12 discipline-level competences in one editable file; no per-organisation variants, no skill dependencies. |
| DP10 | Embedding in the decision environment | MR17 | no | Out of scope. |

MR15 and MR18 have no design principle. MR15 is explained under "Not realised"; MR18 is covered by the evaluation (agreement check) and not by a design principle.

## Where principles were weakened

| DP | Weakening | Why |
|---|---|---|
| DP1 | Links in the demo data point to placeholder addresses until the gold layer produces real ones. | The thesis needs a working instrument first; the contract is the result file. |
| DP2 | Confidence in the demo data is generated, not computed from evidence. | Real confidence comes from the gold layer. |
| DP3 | At submit, cells still at the suggested level with no explicit accept are logged as accepted unchanged. | Avoids blocking the finish; still needs an explicit submit. |
| DP4 | Notes are stored with the research log; no workflow sends them back to the result file. | Contestation for the study instrument; write-back is out of scope. |
| DP5 | Storage is local; hosting for real organisations is not fixed. The classification uses an external model API. | Only public data is used in the study. |
| DP6 | Visibility is declared and displayed, not enforced; no login and no self-view for the assessed person. | The interviews do not converge on who may see what; enforcement would need authentication beyond the study. |
| DP7 | Blind spots on the coverage panel are fixed text, not computed from a coverage report. | Needs the real ingestion report. |
| DP8 | Not yet connected to the real gold layer. | Gold layer is planned. |
| DP9 | One taxonomy for all projects; no skill dependencies. | Per-organisation variants and skill paths are out of scope. |
| DP10 | Not implemented. | Out of scope for the prototype. |

## Not realised, with reason

- **AI assistance (MR15, interviews G1).** Only an explicit marker in a commit can be read (flagged in the Silver layer); real authorship cannot be told from public records. The tool therefore does not claim it: it lists AI assistance among the things the records show only where a commit names an AI tool.
- **Interest as a second dimension (interviews C9).** Needs self-report by the developers, which the study design excludes. It is named as a limitation.
- **Architectural thinking (interviews C13).** Visible in part through the competence "software design and refactoring" and the levels "Solves and explains the cause" and "Others rely on it". The overall view of the architecture is not directly visible in commits.
