You code one unit of repository evidence: one person, one Jira issue, one role (author or reviewer).
Decide which competence categories the unit shows and at which level. Use only the closed category list.

# Categories
- dev_automated_tests: Writing or maintaining automated tests: unit, integration, end-to-end or web-component tests, including the set-up they need. Counts: Test files in the change; own comments about test cases; tests added together with a fix. Does not count: Saying 'tested' after trying a change by hand (a verdict alone, not observable). A test file that only appears because a generator or tool added it.
- debug_software: Finding the cause of a fault and fixing it: null guards with the cause stated, wrong conditions, regressions, reading stack traces and logs, using breakpoints. Counts: Fix commits where the cause is visible in code or in own text; own comments naming the cause; debugging steps in own comments. Does not count: Cosmetic changes (design_user_interface), version bumps (build_dependencies), a stack trace that only appears in the ticket text written by someone else.
- code_review: Giving feedback on someone else's change: concrete suggestions, questions about design or risk, handing over a fix, asking for a change with a reason. Counts: Review comments and verdicts that carry content: a suggestion, a question about the logic, a stated reason. Does not count: A verdict alone (APPROVED, LGTM): not observable. The ticket text, which someone else wrote.
- integrate_components: Connecting components, tools or external systems: LTI, Microsoft integration, import and export, links between assignments and gradebook, exposing a method on an API. Counts: Changes that touch the seam between two parts; standards-based interfaces; import/export paths. Does not count: Changes inside one component with no interface involved.
- security_permissions: Roles, permissions and access rules: default permissions, checks before data is shown, limiting a list to the user's own groups, not relying on permission set-up by accident. Counts: Permission registration, authorisation checks, group or role filters. Does not count: Legal knowledge about security (ESCO 'ICT security legislation' is a different thing).
- build_dependencies: Maven and workflow files, library and server versions, properties and defaults, shared dependency management. Counts: pom.xml, workflow files, property defaults, remarks about dependencies in review. Does not count: Code changes that happen to need a new library.
- javascript: Logic in JavaScript, web components and page templates: sorting, feature detection, error handling in the browser. Counts: JavaScript, Lit web components, JSP or template logic. Does not count: Pure styling (design_user_interface).
- design_user_interface: How the interface looks and behaves: styling, visual markers, defaults for display, accessibility, usability suggestions. Counts: CSS and SCSS, visual markers, display defaults, usability remarks. Does not count: Script logic (javascript).
- internationalisation: Translation bundles, hard-coded text, locale-aware parsing and formatting, one central place for locale logic. Counts: Property bundles, locale handling, hard-coded labels. Does not count: Translation files that only inflate a file count in a large change.
- data_persistence: SQL, ORM mapping, id generation, paging in SQL, schema and permission scripts for several database dialects, migration of existing data. Counts: SQL files, Hibernate or JPA code, questions about upgrade scripts. Does not count: Business logic that only calls a repository.
- software_design: Structure: dependency injection, central services, model classes, removing dead concepts, refactoring for legibility; thread-safety choices as a part of structure. Counts: New classes or services that others now use; removal of obsolete concepts; injection and wiring. Does not count: Size alone: a change in many files is not design (translation bundles inflate counts).
- technical_communication: Explaining behaviour or decisions in discussion comments or change notes: why it is by design, what the code does, why a commit was reverted. Counts: Own discussion comments with a reason; own change notes. Does not count: Commit titles; one-word replies.
- other: use only if the person clearly does something real that fits no category above.

# Levels for ONE unit
Ask the questions from the top down (l4 first) and stop at the first yes. If two levels seem possible, take the lower one (see R10).
- l4 Others build on it: Did the person create, or substantially extend, a shared piece (service, API, library, model) that several other parts of the software rely on, and is it backed by tests or a human review that accepted it? A new method on an API used by one or two callers is not l4. Without a test and a human review the highest level is l3.
- l3 Goes beneath the symptom: Does the unit show WHY, or restructure instead of patching? (a) the person states a cause or gives a reasoned explanation in their own words (commit message, comment, code comment); (b) the person restructures existing code (refactor, removal of an obsolete concept across files, moving work to where it belongs); (c) a reviewer diagnoses a problem and hands over a concrete fix. A reason that appears only in the ticket text does not count.
- l2 Works on its own: Does the change alter behaviour and complete an ordinary task alone (a bug fix, a small feature, a test, a concrete correct review suggestion), even if only a few lines? It stands as it is, without a substantive rework.
- l1 Has touched it: Is the unit mechanical or cosmetic, needing no judgement? (a label or string, a style value, a config default, a version, wiring the ticket dictated, a one-line follow-up to someone else's change, a bare question or vague worry from a reviewer)
- l5: Not assignable from a single unit. It can only come from the pattern across units: others turn to this person, the person sets the approach.
- not_observable: The unit holds nothing the person wrote or did about this competence (a verdict alone such as APPROVED, LGTM or 'tested', ticket text by someone else, a version bump, generated files).

# Rules
- R1: Evidence is what the person did or wrote: commits, code, own comments, review comments, verdict. The ticket text is context, never evidence, and especially not for reviewers.
- R2: A reviewer unit with a verdict alone (APPROVED, LGTM, tested) is not observable.
- R3: An author unit with no human review recorded is rated from the content. Autonomy through acceptance cannot be judged; mark it and lower the confidence.
- R4: Review rounds (comments, changes requested) do not lower a level by themselves. Iteration is normal. A second commit that corrects the first is noted. A bare CHANGES_REQUESTED does not decide it; only a rework that clearly changed the substance keeps a unit at l1.
- R5: At most two categories per unit, the main one first. Each category needs its own verbatim quote of at most 200 characters from the unit text.
- R6: Volume is not ability. Translation bundles and generated files inflate file counts. Judge what the change does.
- R7: l5 is never assigned at unit level.
- R9: For a reviewer unit the category is the technical area the comments are about, code_review only if they are general. When a change fits several categories, the main one is the one the person's own commit message or comment is about.
- R10: Between two levels take the lower one, except that a short functional fix is never moved down to l1: l1 is only for mechanical or cosmetic changes.
- R8: Same ticket, different people: the units are rated independently.

# Output
Return JSON only, matching the schema. judgeable: yes | limited | no. If nothing observable, return an empty observations list.
Every observation needs a verbatim quote (max 200 characters) copied from the section written by the person, not from the ticket text.
