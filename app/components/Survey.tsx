"use client";

import type { SurveyAnswers, Task1Answers } from "@/lib/types";

const AGREE: [string, string] = ["strongly disagree", "strongly agree"];
const SCALE = [1, 2, 3, 4, 5, 6, 7];

type Row<K extends string> = { key: K; label: string };

/** The three items asked after both tasks, worded the same so the answers can be compared. */
export const SURE_LABEL = "I am confident that my ratings describe this developer correctly.";
export const SAME_ROWS: Row<"base" | "effort">[] = [
  { key: "base", label: "I would base a development conversation on these ratings." },
  { key: "effort", label: "This task needed a lot of mental effort from me." },
];

export const TASK2_ROWS: Row<
  | "usefulPerformance"
  | "usefulProductivity"
  | "usefulEffectiveness"
  | "usefulOverall"
  | "usefulConversation"
  | "understandReasons"
  | "foundNew"
  | "checkedRecords"
>[] = [
  // Usefulness: four items adapted from Venkatesh & Davis (2000), "job" replaced by "this assessment".
  { key: "usefulPerformance", label: "Using the system improves my performance in this assessment." },
  { key: "usefulProductivity", label: "Using the system increases my productivity in this assessment." },
  { key: "usefulEffectiveness", label: "Using the system enhances my effectiveness in this assessment." },
  { key: "usefulOverall", label: "I find the system useful for this assessment." },
  // Self-developed item, not part of the Davis scale.
  { key: "usefulConversation", label: "The system would be useful for preparing development conversations." },
  { key: "understandReasons", label: "I could understand why the system proposed what it did." },
  { key: "foundNew", label: "The proposals showed me something I had not noticed in the records." },
  { key: "checkedRecords", label: "Before accepting a proposal, I checked it against the records." },
];

const HELPED: [string, string][] = [
  ["records", "The records (evidence)"],
  ["level", "The proposed level"],
  ["reason", "The reason the system gave"],
  ["confidence", "The confidence shown"],
  ["own", "My own first rating"],
];

export function NumberCard({
  title,
  value,
  onChange,
}: {
  title: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="likert7" role="radiogroup" aria-label={title}>
        {SCALE.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            data-v={v}
            aria-checked={value === v}
            onClick={() => onChange(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="likert2__ends">
        <span>{AGREE[0]}</span>
        <span>{AGREE[1]}</span>
      </div>
    </div>
  );
}

export function AgreeMatrix<K extends string>({
  title,
  rows,
  values,
  onChange,
}: {
  title: string;
  rows: Row<K>[];
  values: Record<K, number | null>;
  onChange: (key: K, v: number) => void;
}) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="mx" role="table" aria-label={title}>
        <div className="mx__row mx__head" role="row">
          <span />
          <div className="mx__cells">
            {SCALE.map((v) => (
              <span key={v} role="columnheader">
                {v}
              </span>
            ))}
          </div>
        </div>
        {rows.map((row) => (
          <div className="mx__row" role="row" key={row.key}>
            <span className="mx__label" role="rowheader">
              {row.label}
            </span>
            <div className="mx__cells" role="radiogroup" aria-label={row.label}>
              {SCALE.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-label={`${row.label} ${v}`}
                  aria-checked={values[row.key] === v}
                  className="mx__dot"
                  onClick={() => onChange(row.key, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mx__ends">
        <span>1 = {AGREE[0]}</span>
        <span>7 = {AGREE[1]}</span>
      </div>
    </div>
  );
}

export const emptyTask1: Task1Answers = { sure: null, base: null, effort: null, missing: "" };
export const emptyTask2: SurveyAnswers = {
  sure: null,
  base: null,
  effort: null,
  usefulPerformance: null,
  usefulProductivity: null,
  usefulEffectiveness: null,
  usefulOverall: null,
  usefulConversation: null,
  understandReasons: null,
  foundNew: null,
  checkedRecords: null,
  helped: [],
  helpedOther: "",
  comment: "",
};

export const task1Complete = (a: Task1Answers) => a.sure != null && a.base != null && a.effort != null;
export const task2Complete = (a: SurveyAnswers) =>
  a.sure != null &&
  a.base != null &&
  a.effort != null &&
  TASK2_ROWS.every((r) => a[r.key] != null);
export const task2Answered = (a: SurveyAnswers) =>
  [a.sure, a.base, a.effort, ...TASK2_ROWS.map((r) => a[r.key])].filter((v) => v != null).length;
export const TASK2_TOTAL = 3 + TASK2_ROWS.length;

/** Questions between Task 1 and Task 2. */
export function Task1Questions({
  answers,
  setAnswers,
}: {
  answers: Task1Answers;
  setAnswers: (fn: (a: Task1Answers) => Task1Answers) => void;
}) {
  return (
    <>
      <p className="lede">1 means strongly disagree, 7 means strongly agree.</p>
      <NumberCard
        title={`1. ${SURE_LABEL}`}
        value={answers.sure}
        onChange={(v) => setAnswers((a) => ({ ...a, sure: v }))}
      />
      <AgreeMatrix
        title="2. How much do you agree?"
        rows={SAME_ROWS}
        values={{ base: answers.base, effort: answers.effort }}
        onChange={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))}
      />
      <div className="card">
        <h3>3. What was missing in the records? Optional</h3>
        <textarea
          aria-label="What was missing in the records"
          rows={3}
          value={answers.missing}
          onChange={(e) => setAnswers((a) => ({ ...a, missing: e.target.value }))}
        />
      </div>
    </>
  );
}

/** Questions after Task 2 and the summary. */
export function Task2Questions({
  answers,
  setAnswers,
}: {
  answers: SurveyAnswers;
  setAnswers: (fn: (a: SurveyAnswers) => SurveyAnswers) => void;
}) {
  return (
    <>
      <p className="lede">1 means strongly disagree, 7 means strongly agree.</p>
      <NumberCard
        title={`1. ${SURE_LABEL}`}
        value={answers.sure}
        onChange={(v) => setAnswers((a) => ({ ...a, sure: v }))}
      />
      <AgreeMatrix
        title="2. How much do you agree?"
        rows={[...SAME_ROWS, ...TASK2_ROWS]}
        values={answers as unknown as Record<string, number | null>}
        onChange={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))}
      />
      <div className="card">
        <h3>3. What helped you decide in Task 2? Tick all that apply. Optional</h3>
        {HELPED.map(([id, label]) => (
          <label className="checkbox" key={id} style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={(answers.helped ?? []).includes(id)}
              onChange={(e) =>
                setAnswers((a) => ({
                  ...a,
                  helped: e.target.checked
                    ? [...(a.helped ?? []), id]
                    : (a.helped ?? []).filter((x) => x !== id),
                }))
              }
            />
            <span>{label}</span>
          </label>
        ))}
        <input
          type="text"
          aria-label="Other"
          placeholder="Other"
          style={{ marginTop: 10 }}
          value={answers.helpedOther ?? ""}
          onChange={(e) => setAnswers((a) => ({ ...a, helpedOther: e.target.value }))}
        />
      </div>
      <div className="card">
        <h3>4. What was missing, or what bothered you? Optional</h3>
        <textarea
          aria-label="Comments"
          rows={3}
          value={answers.comment}
          onChange={(e) => setAnswers((a) => ({ ...a, comment: e.target.value }))}
        />
      </div>
    </>
  );
}
