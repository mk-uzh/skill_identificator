"use client";

/**
 * Plain-language account of how a proposal comes about (interviews P5, P7, P10).
 * Content for an InfoTip next to the proposal in Task 2. It describes the method,
 * not this one cell, so it reads the same for every proposal.
 */
export function HowProposalIsMade() {
  return (
    <span className="tipbody">
      <b>What the system read</b>
      <span className="tipbody__p">
        Every piece of work by this person (a change or a review on one task) was read on its own
        by an AI model (Claude Sonnet 5.5). For each piece it noted which competence it shows and
        at which level, and quoted the passage it relied on. It saw no names.
      </span>
      <b>How the level follows</b>
      <span className="tipbody__p">
        The proposal is the highest level the model found in a single piece of work for this
        competence that it could judge. Nothing is counted: ten routine changes do not add up to a
        higher level. Level 5 is never proposed, because the records cannot show that others follow
        someone&apos;s approach.
      </span>
      <b>How the confidence is set</b>
      <span className="tipbody__p">
        The model is not asked for it. It is calculated from two things: how many of the
        person&apos;s own changes were looked at by a reviewer, and how many pieces of work were
        clear enough to judge. It does not depend on how much work there is.
      </span>
      <b>What it cannot do</b>
      <span className="tipbody__p">
        It reads records, not the person. The note &ldquo;Not visible here&rdquo; under the records
        says what is missing for this competence.
      </span>
    </span>
  );
}
