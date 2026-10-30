# Levels, sharpened (proposal v2, tested once)

Replaces the "Levels" section of `docs/CODEBOOK.md` once accepted. Same five levels and e-CF basis
(EN 16234-1, own wording). The text below is written so that a person and a model can apply it unchanged.

## Levels for ONE unit
Ask the questions from the top down and stop at the first "yes". If two levels seem possible, take the lower one.

- **n/o**: The unit contains nothing the person wrote or did about this competence. This includes: a verdict alone (APPROVED, LGTM, "tested", "works for me"), ticket text written by someone else, a version bump, generated files. If the visible text of a unit is cut ("characters omitted") rate only what is visible.
- **l4 Others build on it**: Did the person create, or substantially extend, a shared piece (service, API, library, model) that SEVERAL other parts of the software rely on, AND is it backed by tests or a human review that accepted it? A new method on an API used by one or two callers is not l4. If no test and no human review is recorded, the highest possible level is l3.
- **l3 Goes beneath the symptom**: Does the unit show WHY, or restructure instead of patching? Yes if one of these is visible: (a) the person states a cause or gives a reasoned explanation in their own words (commit message, comment, code comment); (b) the person restructures existing code (refactor, removal of an obsolete concept across files, moving work to where it belongs); (c) a reviewer diagnoses a problem and hands over a concrete fix. A reason that appears only in the ticket text does not count.
- **l2 Works on its own**: Does the change alter behaviour and complete an ordinary task alone (a bug fix, a small feature, a test, a concrete correct review suggestion), even if it is only a few lines? It stands as it is, without a substantive rework.
- **l1 Has touched it**: Is the unit mechanical or cosmetic, needing no judgement? (a label or string, a style value, a config default, a version, wiring that the ticket dictated, a one-line follow-up to someone else's change, a bare question or vague worry from a reviewer)
- l5 is never given to a unit.

Rules: (1) Only what the person did or wrote counts. Their own commit titles and messages and code comments are their own words and may be quoted; ticket text written by others is context, never evidence. (2) Size is not level: many files, translation bundles and generated files do not raise a level. (3) Review rounds do not lower a level. Only a rework that clearly changed the substance of the work keeps a unit at l1. CHANGES_REQUESTED alone is not enough to decide this. (4) If no human review is recorded, rate from the content. (5) Reviewers: the category is the technical area the comments are about, `code_review` only if they are general. A verdict alone is n/o (this overrides any category text that says otherwise). l3 needs a diagnosis plus a handed-over fix; l2 a concrete correct suggestion; a bare question is l1. (6) When a change fits several categories, the main one is the one the person's own commit message or comment is about. (7) Between two levels take the lower. Exception: do not use this rule to move a short functional fix down to l1; l1 is only for mechanical or cosmetic changes.

## Test of the definitions (first run, by a model)

Setup: the 120 coded units of the Sakai sample, rated blind by a model with the definitions only, one batch of 20
units per rater. Reference = the first coding pass (`coding_proposal_n120_seed42`), **not yet your own judgement**.
v2 was tuned on the 60 `dev` units only and measured on the 60 `test` units.

| | v1 (test units) | v2 (test units) | v2 (dev units, tuned on) |
|---|---|---|---|
| n/o against observable, kappa | 0.93 | 0.93 | 1.00 |
| Level exact (both observed) | 59 % (23/39) | 74 % (29/39) | 77 % (27/35) |
| Level within one step | 100 % | 100 % | 100 % |
| Weighted kappa, linear | 0.44 | 0.69 | 0.73 |
| Weighted kappa, quadratic | 0.58 | 0.78 | 0.82 |
| Main category the same | 31/39 | 28/39 | 26/35 |

Reading: "observable or not" works. The levels improved clearly. The **category** did not: v2 is worse than v1 there,
because the new rules for reviewer units and for the main category are still ambiguous.

Where v2 still differs from the reference: the model is stricter at l3 (7 of 20 reference l3 rated l2), and
l1/l2 and l2/l3 stay the fuzzy borders. Two people without any project knowledge (a model playing a non-programmer,
9 units) agreed with the reference on 6 of 9 units, and within one step on 9 of 9, for v1 and v2 alike.

Limits: the reference is a first pass by the assistant, 39 observed test units are few, the raters are models (not
humans) and the two level examples inside the text come from the sample. Use these numbers as a check of clarity, not
as a result for the thesis. The real test is the agreement with your own coding.

## Open points (your decision)

* **Reviewer units: which category is main?** Technical area of the comments, or `code_review`? Pick one rule.
* **l3 versus l2.** Decide with your own coding whether "a reason only in a code comment" and "a reviewer hands over
  a fix without a cause" are l3.
* **l4.** v2 requires several dependants and tests or an accepted review. Check that this matches your idea.
* **Unit 66** ("APPROVED: tested"): the codebook says n/o, the first coding pass says l1. v2 uses n/o.
