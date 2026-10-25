"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SkillRadar } from "@/components/SkillRadar";
import { Steps } from "@/components/Steps";
import { clientSession } from "@/lib/client-session";
import { cloneMatrix, coalesceMatrix } from "@/lib/matrix";
import { DEVELOPERS } from "@/lib/study-config";
import type { Matrix } from "@/lib/types";

export default function SummaryPage() {
  const router = useRouter();
  const [task1, setTask1] = useState<Matrix | null>(null);
  const [task2, setTask2] = useState<Matrix | null>(null);
  const [devId, setDevId] = useState(DEVELOPERS[0]?.id ?? "devA");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = clientSession.getSessionId();
    if (!id) {
      router.replace("/");
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/session?sessionId=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (res.ok && data.task1Matrix && data.task2Matrix) {
          const t1 = cloneMatrix(data.task1Matrix as Matrix);
          const t2 = coalesceMatrix(data.task2Matrix as Matrix, t1);
          clientSession.setTask1(t1);
          clientSession.setTask2(t2);
          setTask1(t1);
          setTask2(t2);
          return;
        }
      } catch {
        /* fall through to sessionStorage */
      }

      const t1 = clientSession.getTask1();
      const t2 = clientSession.getTask2();
      if (!t1 || !t2) {
        setError("Could not load Task 1 / Task 2 ratings for the overview.");
        return;
      }
      const filled1 = cloneMatrix(t1);
      const filled2 = coalesceMatrix(t2, filled1);
      setTask1(filled1);
      setTask2(filled2);
    })();
  }, [router]);

  if (error) {
    return (
      <div className="page page--narrow">
        <Steps current={3} />
        <div className="card">
          <p className="error">{error}</p>
          <button type="button" className="btn" onClick={() => router.push("/task2")}>
            Back to Task 2
          </button>
        </div>
      </div>
    );
  }

  if (!task1 || !task2) {
    return (
      <div className="page page--narrow">
        <Steps current={3} />
        <div className="card">
          <p className="muted">Loading overview …</p>
        </div>
      </div>
    );
  }

  const developer = DEVELOPERS.find((d) => d.id === devId) ?? DEVELOPERS[0];

  return (
    <div className="page page--narrow">
      <Steps current={3} />
      <div className="card">
        <h1>Overview – Task 1 vs Task 2</h1>
        <p className="lede lede--full">
          Compare your unaided ratings (Task 1) with your final choices after system support (Task 2).
        </p>

        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="radar-dev">Developer</label>
          <select
            id="radar-dev"
            value={devId}
            onChange={(e) => setDevId(e.target.value)}
          >
            {DEVELOPERS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} — {d.role}
              </option>
            ))}
          </select>
        </div>

        <p className="small muted" style={{ marginBottom: 8 }}>
          Showing <strong>{developer.label}</strong> across all competence categories.
        </p>

        <SkillRadar task1={task1} task2={task2} developerId={devId} />

        <div className="field" style={{ marginTop: 20 }}>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I have reviewed the comparison and agree that these are my final ratings. I am ready
              to complete the exercise.
            </span>
          </label>
        </div>

        <div className="actions">
          <span className="small muted">Last step: a short wrap-up questionnaire</span>
          <button
            type="button"
            className="btn"
            disabled={!confirmed}
            onClick={() => router.push("/done")}
          >
            Complete exercise →
          </button>
        </div>
      </div>
    </div>
  );
}
