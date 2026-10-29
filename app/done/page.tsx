"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomBar } from "@/components/BottomBar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { clientSession } from "@/lib/client-session";
import { logger } from "@/lib/logger";
import { VISIBILITY_LABELS, type VisibilityMode } from "@/lib/org-config";
import type { SurveyAnswers, VisibilityPreference } from "@/lib/types";

const QUESTIONS: {
  key: keyof Pick<
    SurveyAnswers,
    "confidenceTask1" | "confidenceTask2" | "trustInSystem" | "perceivedUsefulness"
  >;
  label: string;
  ends: [string, string];
}[] = [
  {
    key: "confidenceTask1",
    label: "How confident were you in your assessment in Task 1?",
    ends: ["very unsure", "very confident"],
  },
  {
    key: "confidenceTask2",
    label: "How confident were you in your assessment in Task 2?",
    ends: ["very unsure", "very confident"],
  },
  {
    key: "trustInSystem",
    label: "How much did you trust the system's suggestions?",
    ends: ["not at all", "completely"],
  },
  {
    key: "perceivedUsefulness",
    label: "How helpful did you find the support provided by the system?",
    ends: ["not helpful at all", "very helpful"],
  },
];

const VISIBILITY_OPTIONS = Object.keys(VISIBILITY_LABELS) as VisibilityMode[];

export default function DonePage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({
    trustInSystem: null,
    confidenceTask1: null,
    confidenceTask2: null,
    perceivedUsefulness: null,
    visibilityPreference: null,
    visibilityReason: "",
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
  const visibilityComplete =
    answers.visibilityPreference != null && answers.visibilityReason.trim().length > 0;
  const canSubmit = likertComplete && visibilityComplete && !busy;

  async function submit() {
    if (!sessionId || !canSubmit) return;
    setBusy(true);
    logger.log("survey_submit", {
      meta: {
        visibilityPreference: answers.visibilityPreference,
      },
    });
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
      <h1 className="title">Four questions</h1>
      <p className="lede">1 is the left end, 7 the right end.</p>

      {QUESTIONS.map((question, qi) => (
        <div className="card" key={question.key}>
          <h3>
            {qi + 1}. {question.label}
          </h3>
          <div className="likert2" role="radiogroup" aria-label={question.label}>
            {[1, 2, 3, 4, 5, 6, 7].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={answers[question.key] === value}
                onClick={() => setAnswers((a) => ({ ...a, [question.key]: value }))}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="likert2__ends">
            <span>{question.ends[0]}</span>
            <span>{question.ends[1]}</span>
          </div>
        </div>
      ))}

      <div className="card">
        <h3>Which visibility would you choose in your organisation, and why?</h3>
        <select
          id="visibilityPreference"
          aria-label="Visibility preference"
          value={answers.visibilityPreference ?? ""}
          onChange={(e) =>
            setAnswers((a) => ({
              ...a,
              visibilityPreference: (e.target.value || null) as VisibilityPreference,
            }))
          }
        >
          <option value="">Select …</option>
          {VISIBILITY_OPTIONS.map((mode) => (
            <option key={mode} value={mode}>
              {VISIBILITY_LABELS[mode]}
            </option>
          ))}
        </select>
        <textarea
          id="visibilityReason"
          aria-label="Reason"
          rows={3}
          style={{ marginTop: 10 }}
          value={answers.visibilityReason}
          placeholder="Briefly, why this setting …"
          onChange={(e) => setAnswers((a) => ({ ...a, visibilityReason: e.target.value }))}
        />
      </div>

      <div className="card">
        <h3>Anything else? Optional</h3>
        <textarea
          id="comment"
          aria-label="Comments"
          rows={3}
          value={answers.comment}
          onChange={(e) => setAnswers((a) => ({ ...a, comment: e.target.value }))}
        />
      </div>

      <BottomBar text={canSubmit ? "Ready to send" : `${answered} of ${QUESTIONS.length} rated, plus the visibility question`}>
        <button type="button" className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? "Sending …" : "Submit"}
        </button>
      </BottomBar>
    </div>
  );
}
