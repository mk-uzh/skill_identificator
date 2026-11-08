"use client";

/**
 * Plain-language account of how a proposal comes about (interviews P5, P7, P10).
 *
 * Shown in Task 2 only, next to the proposal. It describes the method, not this
 * one cell, so it reads the same for every proposal. Opening it is logged
 * ("rationale_open") so the analysis can tell who looked at the explanation.
 */
export function HowProposalIsMade({ onToggle }: { onToggle?: (open: boolean) => void }) {
  return (
    <details className="acc" onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>How the proposal is made</summary>
      <p>
        <strong>What the system read.</strong> Every piece of work by this person (a change or a
        review on one task) was read on its own by an AI model (Claude Sonnet 5.5). For each
        piece it noted which competence it shows and at which level, and quoted the passage it
        relied on. It saw no names.
      </p>
      <p>
        <strong>How the level follows.</strong> The proposal is the highest level the model found
        in a single piece of work for this competence that it could judge. Nothing is counted:
        ten routine changes do not add up to a higher level. Level 5 is never proposed, because
        the records cannot show that others follow someone&apos;s approach.
      </p>
      <p>
        <strong>How the confidence is set.</strong> The model is not asked for it. It is
        calculated from two things: how many of the person&apos;s own changes were looked at by a
        reviewer, and how many pieces of work were clear enough to judge. It does not depend on
        how much work there is.
      </p>
      <p>
        <strong>What it cannot do.</strong> It reads records, not the person. The note
        &ldquo;Not visible here&rdquo; under the records says what is missing for this competence.
      </p>
    </details>
  );
}
