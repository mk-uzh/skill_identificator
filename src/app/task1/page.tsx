"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DeveloperProfile } from "@/components/DeveloperProfile";
import { Legend } from "@/components/Legend";
import { SkillMatrix } from "@/components/SkillMatrix";
import { Steps } from "@/components/Steps";
import { clientSession } from "@/lib/client-session";
import { logger } from "@/lib/logger";
import { countFilled, emptyMatrix, isComplete, setCell, TOTAL_CELLS } from "@/lib/matrix";
import { DEVELOPERS } from "@/lib/study-config";
import type { Matrix, SkillLevel } from "@/lib/types";

export default function Task1Page() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix);
  const [openProfile, setOpenProfile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = clientSession.getSessionId();
    if (!id) {
      router.replace("/");
      return;
    }
    setSessionId(id);
    logger.start(id, 1);
    logger.log("task_start", { meta: { task: 1 } });
  }, [router]);

  const filled = useMemo(() => countFilled(matrix), [matrix]);
  const complete = isComplete(matrix);

  function handleChange(devId: string, categoryId: string, next: SkillLevel | null) {
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

  async function submit() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    const durationMs = logger.elapsed();
    logger.log("task_submit", { meta: { task: 1, durationMs } });
    await logger.flush();

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, task: 1, matrix, durationMs }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Saving failed");

      clientSession.setTask1(matrix);
      clientSession.setSuggestions(data.suggestions ?? []);
      router.push("/task2");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
      setBusy(false);
    }
  }

  const profileDeveloper = DEVELOPERS.find((d) => d.id === openProfile) ?? null;

  return (
    <div className="page page--wide">
      <Steps current={1} />
      <div className="card">
        <h1>Task 1 – your assessment</h1>
        <p className="lede">
          Please rate each person&apos;s expertise per category based on your own judgement. There
          is no system support in this step. Clicking a name opens the short profile.
        </p>

        <SkillMatrix
          matrix={matrix}
          onCellChange={handleChange}
          onCellOpen={(devId, categoryId) => logger.log("cell_open", { devId, categoryId })}
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
          onClose={() => {
            logger.log("profile_close", { devId: profileDeveloper.id });
            setOpenProfile(null);
          }}
        />
      )}
    </div>
  );
}
