"use client";

import { CATEGORIES } from "@/lib/study-config";
import {
  SKILL_LEVEL_VALUE,
  type Matrix,
  type SuggestionOutcome,
  type SurveyAnswers,
  type Task1Answers,
} from "@/lib/types";

const COLOR = { t1: "#9aa093", t2: "#5d9420", accepted: "#6a9f7b", adjusted: "#d9a441", rejected: "#c0605a", line: "#c9ccc4" };
const DECISION_COLOR: Record<string, string> = {
  accepted_unchanged: COLOR.accepted,
  adjusted: COLOR.adjusted,
  rejected: COLOR.rejected,
};
const DECISION_NAME: Record<string, string> = {
  accepted_unchanged: "accepted",
  adjusted: "adjusted",
  rejected: "rejected",
};

const ROW = 26;
const TOP = 34;
const X0 = 200; // level axis start (n/o)
const STEP = 40; // per level
const TX = 440; // time bars start
const TW = 150; // time bars width
const BX = 622; // marker column

function lvl(m: Matrix, dev: string, cat: string): number {
  const l = m[dev]?.[cat] ?? null;
  return l ? SKILL_LEVEL_VALUE[l] ?? 0 : 0;
}

/** One bar from 1 to 7: filled up to the value, square-ish corners like the occupation bars. */
function Segs({ value, color }: { value: number | null | undefined; color: string }) {
  return (
    <span className="solid" role="img" aria-label={value != null ? `${value} of 7` : "no answer"}>
      <i style={{ width: `${((value ?? 0) / 7) * 100}%`, background: color }} />
    </span>
  );
}

export function Dashboard({
  devId,
  task1,
  task2,
  outcomes,
  survey1,
  survey2,
}: {
  devId: string;
  task1: Matrix;
  task2: Matrix;
  outcomes: SuggestionOutcome[];
  survey1: Task1Answers | null;
  survey2: SurveyAnswers | null;
}) {
  const mine = outcomes.filter((o) => o.devId === devId);
  const maxSec = Math.max(10, ...mine.map((o) => (o.timeToDecisionMs ?? 0) / 1000));
  const height = TOP + CATEGORIES.length * ROW + 8;

  const compare: [string, number | null | undefined, number | null | undefined][] = [
    ["Confident in my ratings", survey1?.sure, survey2?.sure],
    ["Would base a conversation on them", survey1?.base, survey2?.base],
    ["Mental effort", survey1?.effort, survey2?.effort],
  ];
  const usefulParts = [
    survey2?.usefulPerformance,
    survey2?.usefulProductivity,
    survey2?.usefulEffectiveness,
    survey2?.usefulOverall,
  ];
  const usefulMean = usefulParts.every((v) => v != null)
    ? Math.round((usefulParts.reduce((a, v) => a + (v as number), 0) / 4) * 10) / 10
    : null;
  const task2Items: [string, number | null | undefined][] = [
    ["Useful for this assessment (mean of 4 items)", usefulMean],
    ["Useful for preparing conversations", survey2?.usefulConversation],
    ["I understood the reasons", survey2?.understandReasons],
    ["Showed me something new", survey2?.foundNew],
    ["I checked proposals against records", survey2?.checkedRecords],
  ];

  return (
    <div className="dash dash--two">
      <div className="dash__side">
        <div className="card">
          <h3>Your answers after Task 1 and Task 2</h3>
          {survey1 && survey2 ? (
            compare.map(([label, x, y]) => (
              <div className="dash__pair" key={label}>
                <span>{label}</span>
                <div className="dash__bar"><Segs value={x} color={COLOR.t1} /><b>{x ?? "–"}</b></div>
                <div className="dash__bar"><Segs value={y} color={COLOR.t2} /><b>{y ?? "–"}</b></div>
              </div>
            ))
          ) : (
            <p className="small muted">The answers after Task 1 are not available.</p>
          )}
          <div className="dash__key small muted">
            <span><i style={{ background: COLOR.t1 }} /> Task 1</span>
            <span><i style={{ background: COLOR.t2 }} /> Task 2</span>
            <span>Scale 1 to 7</span>
          </div>
        </div>
        <div className="card">
          <h3>What you said about Task 2</h3>
          {survey2 ? (
            task2Items.map(([label, v]) => (
              <div className="dash__pair" key={label}>
                <span>{label}</span>
                <div className="dash__bar"><Segs value={v} color={COLOR.t2} /><b>{v ?? "–"}</b></div>
              </div>
            ))
          ) : (
            <p className="small muted">No answers yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
