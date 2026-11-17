"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomBar } from "@/components/BottomBar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Task2Questions, emptyTask2, task2Answered, task2Complete, TASK2_TOTAL } from "@/components/Survey";
import { clientSession } from "@/lib/client-session";
import { logger } from "@/lib/logger";

export default function QuestionsPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState(emptyTask2);
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
    if (!sessionId || !task2Complete(answers) || busy) return;
    setBusy(true);
    logger.log("survey_submit");
    await logger.flush();
    try {
      await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, survey: answers }),
      });
      try {
        window.sessionStorage.setItem("devskill.survey2", JSON.stringify(answers));
      } catch {
        /* storage may be blocked */
      }
      router.push("/summary");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--flow page--narrow2">
      {busy && <LoadingSpinner fullPage label="Saving …" />}
      <p className="crumb">After Task 2</p>
      <h1 className="title">A few questions about Task 2</h1>
      <Task2Questions answers={answers} setAnswers={setAnswers} />
      <BottomBar
        text={task2Complete(answers) ? "Ready for the summary" : `${task2Answered(answers)} of ${TASK2_TOTAL} rated`}
      >
        <button type="button" className="btn" disabled={!task2Complete(answers) || busy} onClick={submit}>
          {busy ? "Saving …" : "Continue to the summary →"}
        </button>
      </BottomBar>
    </div>
  );
}
