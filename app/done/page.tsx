"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomBar } from "@/components/BottomBar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { clientSession } from "@/lib/client-session";
import { logger } from "@/lib/logger";
import type { SurveyAnswers } from "@/lib/types";

type LikertKey = Exclude<
  keyof SurveyAnswers,
  "visibilityPreference" | "visibilityReason" | "comment"
>;

const AGREE: [string, string] = ["strongly disagree", "strongly agree"];

const CONFIDENCE: { key: LikertKey; label: string }[] = [
  { key: "confidenceTask1", label: "In Task 1 (my own ratings), I was confident in my assessments." },
  { key: "confidenceTask2", label: "In Task 2 (after the proposals), I am confident in my final assessments." },
];

const MATRIX: { key: LikertKey; label: string }[] = [
  { key: "usefulSpeed", label: "The system would help me judge expertise faster." },
  { key: "usefulQuality", label: "The system would help me make better judgements of expertise." },
  { key: "usefulWork", label: "The system would be useful in my work." },
  { key: "relianceUnderstand", label: "I could understand why the system proposed what it did." },
];

const QUESTIONS = [...CONFIDENCE, ...MATRIX];

const HELPED: [string, string][] = [
  ["records", "The records (evidence)"],
  ["level", "The proposed level"],
  ["reason", "The reason the system gave"],
  ["confidence", "The confidence shown"],
  ["own", "My own first rating"],
];

export default function DonePage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({
    confidenceTask1: null,
    confidenceTask2: null,
    usefulSpeed: null,
    usefulQuality: null,
    usefulWork: null,
    relianceUnderstand: null,
    visibilityPreference: null,
    visibilityReason: "",
    helped: [],
    helpedOther: "",
    comment: "",
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = clientSession.getSessionId();
    if (!id) {
      router.replace("/");
      return;
    }
    setSessionId(id);
    logger.start(id, 0);
  }, [router]);

  const likertComplete = QUESTIONS.every((q) => answers[q.key] != null);
  const canSubmit = likertComplete && !busy;

  async function submit() {
    if (!sessionId || !canSubmit) return;
    setBusy(true);
    logger.log("survey_submit");
    await logger.flush();
    try {
      await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, survey: answers }),
      });
      setSent(true);
      clientSession.clear();
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="page page--narrow2">
        <div className="card thanks">
          <span className="thanks__mark" aria-hidden="true">
            ✓
          </span>
          <h1 className="title">Thank you</h1>
          <p className="lede">Your answers are saved. You can close this window.</p>
        </div>
      </div>
    );
  }

  const answered = QUESTIONS.filter((q) => answers[q.key] != null).length;

  return (
    <div className="page page--narrow2 page--flow">
      {busy && <LoadingSpinner fullPage label="Sending …" />}
      <p className="crumb">Last step</p>
      <div className="cardhead">
        <h1 className="title">A few questions</h1>
      {process.env.NODE_ENV !== "production" && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() =>
            setAnswers((a) => {
              const r = () => 1 + Math.floor(Math.random() * 7);
              return {
                ...a,
                confidenceTask1: r(),
                confidenceTask2: r(),
                usefulSpeed: r(),
                usefulQuality: r(),
                usefulWork: r(),
                relianceUnderstand: r(),
              };
            })
          }
        >
          Fill in randomly (testing only)
        </button>
      )}
      </div>
      <p className="lede">1 means strongly disagree, 7 means strongly agree.</p>

      {CONFIDENCE.map((question, qi) => (
        <div className="card" key={question.key}>
          <h3>
            {qi + 1}. {question.label}
          </h3>
          <div className="likert7" role="radiogroup" aria-label={question.label}>
            {[1, 2, 3, 4, 5, 6, 7].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                data-v={value}
                aria-checked={answers[question.key] === value}
                onClick={() => setAnswers((a) => ({ ...a, [question.key]: value }))}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="likert2__ends">
            <span>{AGREE[0]}</span>
            <span>{AGREE[1]}</span>
          </div>
        </div>
      ))}

      <div className="card">
        <h3>3. How much do you agree?</h3>
        <div className="mx" role="table" aria-label="Agreement">
          <div className="mx__row mx__head" role="row">
            <span />
            <div className="mx__cells">
              {[1, 2, 3, 4, 5, 6, 7].map((v) => (
                <span key={v} role="columnheader">
                  {v}
                </span>
              ))}
            </div>
          </div>
          {MATRIX.map((row) => (
            <div className="mx__row" role="row" key={row.key}>
              <span className="mx__label" role="rowheader">
                {row.label}
              </span>
              <div className="mx__cells" role="radiogroup" aria-label={row.label}>
                {[1, 2, 3, 4, 5, 6, 7].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-label={`${row.label} ${v}`}
                    aria-checked={answers[row.key] === v}
                    className="mx__dot"
                    onClick={() => setAnswers((a) => ({ ...a, [row.key]: v }))}
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

      <div className="card">
        <h3>4. What helped you decide in Task 2? Tick all that apply. Optional</h3>
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
        <h3>5. What was missing, or what bothered you? Optional</h3>
        <textarea
          id="comment"
          aria-label="Comments"
          rows={3}
          value={answers.comment}
          onChange={(e) => setAnswers((a) => ({ ...a, comment: e.target.value }))}
        />
      </div>

      <BottomBar text={canSubmit ? "Ready to send" : `${answered} of ${QUESTIONS.length} rated`}>
        <button type="button" className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? "Sending …" : "Submit"}
        </button>
      </BottomBar>
    </div>
  );
}
