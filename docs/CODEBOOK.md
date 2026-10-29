# Codebook (proposal v1)

Derived from open coding of 120 evidence units (`pipeline/data/sakai/silver/samples/sample_n120_seed42.*`, seed 42). The coding in `coding_proposal_n120_seed42.xlsx` is a first pass for the codebook. The gold standard is the researcher's own judgement, made on these units before any model sees them.

## What the sample showed

- 120 units: 57 author, 63 reviewer. Seen with at least one category: 76.
- **44 of 63 reviewer units hold a verdict only** and are not observable. Reviewer units are 53% of all 3,000 units, so a large share of all units cannot carry a skill statement.
- 9 of 57 author units have no human review recorded.
- Unit-level observed levels: l1 21, l2 47, l3 29, l4 3, l5 0.
- The same ticket shows up for several people (five pairs in the sample), which allows author and reviewer to be compared on one piece of work.

## Categories (12)

| # | Key | Group | Source in ESCO profile | Units in sample |
|---|---|---|---|---|
| 1 | `dev_automated_tests` | Testing and quality assurance | local | 9 |
| 2 | `debug_software` | Testing and quality assurance | esco-essential | 12 |
| 3 | `code_review` | Testing and quality assurance | local | 17 |
| 4 | `integrate_components` | Backend development | esco-optional | 10 |
| 5 | `security_permissions` | Backend development | local | 5 |
| 6 | `build_dependencies` | Backend development | esco-essential, esco-optional | 6 |
| 7 | `javascript` | Frontend development | esco-optional | 11 |
| 8 | `design_user_interface` | Frontend development | esco-optional | 6 |
| 9 | `internationalisation` | Frontend development | local | 4 |
| 10 | `data_persistence` | Data and persistence | esco-optional | 5 |
| 11 | `software_design` | Architecture, design and communication | esco-essential, esco-optional | 8 |
| 12 | `technical_communication` | Architecture, design and communication | esco-essential | 5 |

No category fitted two units (99 and 105, generic backend logic). They stay as `other` with a free-text label, so the model can propose new categories bottom-up.

### 1. develop automated software tests (`dev_automated_tests`)

- **Definition.** Writing or maintaining automated tests: unit, integration, end-to-end or web-component tests, including the set-up they need.
- **Counts as evidence.** Test files in the change; own comments about test cases; tests added together with a fix.
- **Does not count.** Saying 'tested' after trying a change by hand (that is review, level 1). A test file that only appears because a generator or tool added it.
- **ESCO / e-CF.** develop automated software tests (local). e-CF: B.3 Testing (e-CF levels e-1 to e-4).
- **Sample units.** 13, 33, 53, 75, 88

### 2. debug software (`debug_software`)

- **Definition.** Finding the cause of a fault and fixing it: null guards with the cause stated, wrong conditions, regressions, reading stack traces and logs, using breakpoints.
- **Counts as evidence.** Fix commits where the cause is visible in code or in own text; own comments naming the cause; debugging steps in own comments.
- **Does not count.** Cosmetic changes (design_user_interface), version bumps (build_dependencies), a stack trace that only appears in the ticket text written by someone else.
- **ESCO / e-CF.** debug software (esco-essential); ICT debugging tools (esco-essential). e-CF: C.4 Problem Management (proposal).
- **Sample units.** 18, 46, 75, 108, 114

### 3. review other people's code (`code_review`)

- **Definition.** Giving feedback on someone else's change: concrete suggestions, questions about design or risk, handing over a fix, asking for a change with a reason.
- **Counts as evidence.** Review comments and verdicts that carry content: a suggestion, a question about the logic, a stated reason.
- **Does not count.** A verdict alone (APPROVED, LGTM): not observable. The ticket text, which someone else wrote.
- **ESCO / e-CF.** review other people's code (local). e-CF: none identified.
- **Sample units.** 7, 31, 36, 44, 102

### 4. integrate system components (`integrate_components`)

- **Definition.** Connecting components, tools or external systems: LTI, Microsoft integration, import and export, links between assignments and gradebook, exposing a method on an API.
- **Counts as evidence.** Changes that touch the seam between two parts; standards-based interfaces; import/export paths.
- **Does not count.** Changes inside one component with no interface involved.
- **ESCO / e-CF.** integrate system components (esco-optional). e-CF: B.2 Component Integration (e-CF levels e-2 to e-4).
- **Sample units.** 8, 21, 30, 68, 100

### 5. security and permissions (`security_permissions`)

- **Definition.** Roles, permissions and access rules: default permissions, checks before data is shown, limiting a list to the user's own groups, not relying on permission set-up by accident.
- **Counts as evidence.** Permission registration, authorisation checks, group or role filters.
- **Does not count.** Legal knowledge about security (ESCO 'ICT security legislation' is a different thing).
- **ESCO / e-CF.** security and permissions (local). e-CF: none identified.
- **Sample units.** 22, 85, 89, 97, 104

### 6. build, dependencies and configuration (`build_dependencies`)

- **Definition.** Maven and workflow files, library and server versions, properties and defaults, shared dependency management.
- **Counts as evidence.** pom.xml, workflow files, property defaults, remarks about dependencies in review.
- **Does not count.** Code changes that happen to need a new library.
- **ESCO / e-CF.** tools for software configuration management (esco-essential); Apache Maven (esco-optional). e-CF: B.4 Solution Deployment (proposal).
- **Sample units.** 14, 81, 102, 106, 118

### 7. JavaScript (frontend code) (`javascript`)

- **Definition.** Logic in JavaScript, web components and page templates: sorting, feature detection, error handling in the browser.
- **Counts as evidence.** JavaScript, Lit web components, JSP or template logic.
- **Does not count.** Pure styling (design_user_interface).
- **ESCO / e-CF.** JavaScript (esco-optional). e-CF: B.1 Application Development (e-CF levels e-1 to e-3).
- **Sample units.** 3, 24, 43, 104, 110

### 8. design user interface (`design_user_interface`)

- **Definition.** How the interface looks and behaves: styling, visual markers, defaults for display, accessibility, usability suggestions.
- **Counts as evidence.** CSS and SCSS, visual markers, display defaults, usability remarks.
- **Does not count.** Script logic (javascript).
- **ESCO / e-CF.** design user interface (esco-optional). e-CF: none identified.
- **Sample units.** 19, 45, 56, 63, 78

### 9. internationalisation (`internationalisation`)

- **Definition.** Translation bundles, hard-coded text, locale-aware parsing and formatting, one central place for locale logic.
- **Counts as evidence.** Property bundles, locale handling, hard-coded labels.
- **Does not count.** Translation files that only inflate a file count in a large change.
- **ESCO / e-CF.** internationalisation (local). e-CF: none identified.
- **Sample units.** 24, 42, 54, 107

### 10. data and persistence (`data_persistence`)

- **Definition.** SQL, ORM mapping, id generation, paging in SQL, schema and permission scripts for several database dialects, migration of existing data.
- **Counts as evidence.** SQL files, Hibernate or JPA code, questions about upgrade scripts.
- **Does not count.** Business logic that only calls a repository.
- **ESCO / e-CF.** migrate existing data (esco-optional); use query languages (esco-optional). e-CF: none identified.
- **Sample units.** 22, 31, 39, 64, 91

### 11. software design and refactoring (`software_design`)

- **Definition.** Structure: dependency injection, central services, model classes, removing dead concepts, refactoring for legibility; thread-safety choices as a part of structure.
- **Counts as evidence.** New classes or services that others now use; removal of obsolete concepts; injection and wiring.
- **Does not count.** Size alone: a change in many files is not design (translation bundles inflate counts).
- **ESCO / e-CF.** use software design patterns (esco-essential); object-oriented modelling (esco-optional); use concurrent programming (esco-optional). e-CF: A.6 Application Design (proposal).
- **Sample units.** 13, 40, 47, 48, 54

### 12. explain decisions in writing (`technical_communication`)

- **Definition.** Explaining behaviour or decisions in discussion comments or change notes: why it is by design, what the code does, why a commit was reverted.
- **Counts as evidence.** Own discussion comments with a reason; own change notes.
- **Does not count.** Commit titles; one-word replies.
- **ESCO / e-CF.** provide technical documentation (esco-essential). e-CF: B.5 Documentation Production (e-CF levels e-1 to e-3).
- **Sample units.** 33, 34, 48, 50, 79

## What changed against taxonomy v2 (10 categories)

- `ict_debugging_tools` → `debug_software`: one observation in 120 units; a part of debugging.
- `concurrent_programming` → `software_design`: 2 of 120 units; about 3% of all units mention concurrency terms; kept as a concept.
- `object_oriented_modelling` → `software_design`: not separable from design patterns in the data.
- `design_patterns` → `software_design`: renamed.
- `migrate_existing_data` → `data_persistence`: widened to SQL, mapping and migration.
- Added from the data: `code_review`, `security_permissions`, `build_dependencies`, `internationalisation`, `technical_communication`.
- `develop automated software tests` is not linked to the ESCO profile of software developer. `model/roles.json` has a software tester role, which is the likely origin. It stays as a local category and is anchored in e-CF B.3 Testing.

## Levels

Five levels as in the e-CF (EN 16234-1). The descriptions are our own wording. Person-level descriptions are in `taxonomy.json`. For coding a single unit:

- **l1.** Small change inside something that exists (a few lines, a label, a version), or a single remark. The approach came from the ticket or from someone else.
- **l2.** An ordinary task done independently and completely. If a review is recorded, it was accepted without a rework round that changed the substance.
- **l3.** Finds the cause of a non-obvious fault, or changes the structure instead of working around it, or explains the reasoning. For reviews: reasoned feedback or a fix handed over.
- **l4.** A change across several components or tools, or something others reuse, backed by tests and a long review thread.
- **l5.** Not assignable from a single unit. It can only come from the pattern across units: others turn to this person, the person sets the approach.
- **n/o.** The unit holds nothing the person wrote or did about this competence (for example a verdict alone).

The e-CF defines levels only up to e-3 or e-4 for most build competences (B.1 up to e-3, B.2 and B.3 up to e-4). l4 and l5 here therefore go beyond what the e-CF foresees for these competences. This has to be stated in the thesis.

## Coding rules

- **R1.** Evidence is what the person did or wrote: commits, code, own comments, review comments, verdict. The ticket text is context, never evidence, and especially not for reviewers.
- **R2.** A reviewer unit with a verdict alone (APPROVED, LGTM, tested) is not observable. In the sample this is 44 of 63 reviewer units.
- **R3.** An author unit with no human review recorded is rated from the content. Autonomy through acceptance cannot be judged; mark it and lower the confidence (9 of 57 author units).
- **R4.** Review rounds (comments, changes requested) do not lower a level by themselves. Iteration is normal. A second commit that corrects the first is noted.
- **R5.** At most two categories per unit, the main one first. Each category needs its own verbatim quote of at most 200 characters from the unit text.
- **R6.** Volume is not ability. Translation bundles and generated files inflate file counts (units 8, 48, 75). Judge what the change does.
- **R7.** l5 is never assigned at unit level.
- **R8.** Same ticket, different people: the units are rated independently (units 3 and 29, 11 and 40, 28 and 54, 96 and 114, 49 and 93).

## Not decided yet

- Whether l5 stays on the scale for persons. It can only arise from aggregation.
- Whether `other` should be kept in the classifier output or whether a unit with no fitting category is simply left without a category.
- ESCO URI for `use query languages` (portal only) and a source for the e-CF counterparts marked as proposal.
