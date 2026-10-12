"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DeveloperProfile } from "@/components/DeveloperProfile";
import { Legend } from "@/components/Legend";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SkillMatrix } from "@/components/SkillMatrix";
import { Steps } from "@/components/Steps";
import { CellTracker } from "@/lib/cell-tracker";
import { clientSession } from "@/lib/client-session";
import { nowIsoMs } from "@/lib/interaction-log";
import { logger } from "@/lib/logger";
import {
  cloneMatrix,
  countFilled,
  emptyMatrix,
  isComplete,
  randomMatrix,
  setCell,
  TOTAL_CELLS,
} from "@/lib/matrix";
import { DEVELOPERS } from "@/lib/study-config";
import type { Matrix, SkillLevel } from "@/lib/types";

export default function Task1Page() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>("");
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix);
  const [openProfile, setOpenProfile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tracker = useRef(new CellTracker());
  const startedAt = useRef<string>(nowIsoMs());

  useEffect(() => {
    const id = clientSession.getSessionId();
    const code = clientSession.getParticipantCode() ?? "";
    if (!id) {
      router.replace("/");
      return;
    }

    void fetch(`/api/session?sessionId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.task2Submitted) {
          router.replace("/done");
        }
      })
      .catch(() => undefined);

    // Restore previous Task 1 answers when coming back from Task 2.
    const existing = clientSession.getTask1();
    if (existing) {
      setMatrix(cloneMatrix(existing));
    }

    setSessionId(id);
    setParticipantId(code);
    startedAt.current = nowIsoMs();
    logger.start(id, 1);
    logger.log("task_start", { meta: { task: 1 } });
  }, [router]);

  const filled = useMemo(() => countFilled(matrix), [matrix]);
  const complete = isComplete(matrix);

  function handleChange(devId: string, categoryId: string, next: SkillLevel | null) {
    tracker.current.change(devId, categoryId);
    setMatrix((current) => {
      logger.log("cell_change", {
        devId,
        categoryId,
        from: current[devId]?.[categoryId] ?? null,
        to: next,
      });
      return setCell(current, devId, categoryId, next);
    });
  }

  function fillDefault() {
    const next = randomMatrix();
    for (const [devId, byCategory] of Object.entries(next)) {
      for (const categoryId of Object.keys(byCategory)) {
        tracker.current.open(devId, categoryId);
        tracker.current.change(devId, categoryId);
      }
    }
    setMatrix(next);
    logger.log("cell_change", { meta: { action: "default_fill", task: 1 } });
  }

  async function submit() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    const durationMs = logger.elapsed();
    const committedAt = nowIsoMs();
    const interactions = tracker.current.buildTask1Rows({
      sessionId,
      participantId: participantId || "unknown",
      matrix,
      committedAt,
    });

    logger.log("task_submit", { meta: { task: 1, durationMs } });
    await logger.flush();

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          task: 1,
          matrix,
          durationMs,
          startedAt: startedAt.current,
          interactions,
          recalculate: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Saving failed");

      clientSession.setTask1(matrix);
      clientSession.setSuggestions(data.suggestions ?? []);
      if (data.prefill) {
        clientSession.setPrefill(data.prefill);
      }
      router.push("/task2");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
      setBusy(false);
    }
  }

  const profileDeveloper = DEVELOPERS.find((d) => d.id === openProfile) ?? null;

  return (
    <div className="page page--wide">
      {busy && <LoadingSpinner fullPage label="Preparing Task 2 …" />}
      <Steps current={1} />
      <div className="card">
        <div className="card__title-row">
          <h1>Task 1 – your assessment</h1>
          <button type="button" className="btn btn--ghost" onClick={fillDefault}>
            Default
          </button>
        </div>
        <p className="lede">
          Please rate each person&apos;s expertise per category based on your own judgement. There
          is no system support in this step, no suggestions, confidence values or evidence.
        </p>

        <SkillMatrix
          mode="task1"
          matrix={matrix}
          onCellChange={handleChange}
          onCellOpen={(devId, categoryId) => {
            tracker.current.open(devId, categoryId);
            logger.log("cell_open", { devId, categoryId });
          }}
          onProfileOpen={(devId) => {
            setOpenProfile(devId);
            logger.log("profile_open", { devId });
          }}
        />

        <Legend />

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <span className="small muted">
            {filled} of {TOTAL_CELLS} fields completed
          </span>
          <button type="button" className="btn" disabled={!complete || busy} onClick={submit}>
            {busy ? "Saving …" : "Continue to Task 2 →"}
          </button>
        </div>
        {!complete && (
          <p className="small muted" style={{ textAlign: "right", marginTop: 4 }}>
            Please complete all fields to continue.
          </p>
        )}
      </div>

      {profileDeveloper && (
        <DeveloperProfile
          developer={profileDeveloper}
          showEvidence={false}
          onClose={() => {
            logger.log("profile_close", { devId: profileDeveloper.id });
            setOpenProfile(null);
          }}
        />
      )}
    </div>
  );
}
