"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Steps } from "@/components/Steps";
import { clientSession } from "@/lib/client-session";
import { logger } from "@/lib/logger";
import type { SurveyAnswers } from "@/lib/types";

const QUESTIONS: { key: keyof Omit<SurveyAnswers, "comment">; label: string; ends: [string, string] }[] =
  [
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

export default function DonePage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({
    trustInSystem: null,
    confidenceTask1: null,
    confidenceTask2: null,
    perceivedUsefulness: null,
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

  async function submit() {
    if (!sessionId) return;
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
      <div className="page page--narrow">
        <Steps current={3} />
        <div className="card">
          <h1>Thank you for taking part</h1>
          <p className="lede">
            Your answers have been saved. You can close this window now.
          </p>
          <p className="small muted">
            If you have questions about the study, please contact the study team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <Steps current={3} />
      <div className="card">
        <h1>Final questions</h1>
        <p className="lede">
          Four short questions about how you experienced the two tasks (1 = left, 7 = right).
        </p>

        {QUESTIONS.map((question) => (
          <div className="field" key={question.key}>
            <label>{question.label}</label>
            <div className="likert">
              {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={answers[question.key] === value}
                  onClick={() => setAnswers((a) => ({ ...a, [question.key]: value }))}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="likert__ends">
              <span>{question.ends[0]}</span>
              <span>{question.ends[1]}</span>
            </div>
          </div>
        ))}

        <div className="field">
          <label htmlFor="comment">Comments (optional)</label>
          <textarea
            id="comment"
            rows={4}
            value={answers.comment}
            onChange={(e) => setAnswers((a) => ({ ...a, comment: e.target.value }))}
          />
        </div>

        <div className="actions">
          <span />
          <button type="button" className="btn" disabled={busy} onClick={submit}>
            {busy ? "Sending …" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
