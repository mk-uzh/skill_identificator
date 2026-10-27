"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CompetenceList } from "@/components/CompetenceList";
import { EvidencePanel } from "@/components/EvidencePanel";
import { LevelGuide } from "@/components/LevelGuide";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PersonCard } from "@/components/PersonCard";
import { Steps } from "@/components/Steps";
import { StudyBanner } from "@/components/StudyBanner";
import { CellTracker } from "@/lib/cell-tracker";
import { clientSession } from "@/lib/client-session";
import { nowIsoMs } from "@/lib/interaction-log";
import { logger } from "@/lib/logger";
import { cloneMatrix, developerMatrix, emptyMatrix, setCell } from "@/lib/matrix";
import { CATEGORIES, DEVELOPERS } from "@/lib/study-config";
import {
  afterOwn,
  BLOCK_COUNT,
  blockFromLocation,
  developerOrder,
  isLastBlock,
} from "@/lib/study-flow";
import { SKILL_LEVELS, type Matrix, type SkillLevel } from "@/lib/types";

/**
 * Own assessment of ONE person, every competence, without system support.
 *
 * First half of a block. The participant sees the same records here that the
 * system's reasoning will refer to afterwards; what is withheld is only the
 * level the system derived from them.
 */
export default function Task1Page() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [block, setBlock] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix);
  const [selected, setSelected] = useState<string | null>(CATEGORIES[0]?.id ?? null);
  const [ready, setReady] = useState(false);
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
    const currentBlock = blockFromLocation();
    const devIds = developerOrder(code);

    void fetch(`/api/session?sessionId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.task2Submitted) router.replace("/done");
      })
      .catch(() => undefined);

    const existing = clientSession.getTask1();
    if (existing) setMatrix(cloneMatrix(existing));

    setSessionId(id);
    setParticipantId(code);
    setBlock(currentBlock);
    setOrder(devIds);
    startedAt.current = nowIsoMs();
    clientSession.setStartOnce(1, startedAt.current);
    logger.start(id, 1);
    logger.log("task_start", {
      meta: { task: 1, block: currentBlock, devId: devIds[currentBlock] },
    });
    setReady(true);
  }, [router]);

  const devId = order[block];
  const developer = useMemo(
    () => DEVELOPERS.find((d) => d.id === devId) ?? null,
    [devId],
  );

  const filled = useMemo(
    () => (devId ? CATEGORIES.filter((c) => matrix[devId]?.[c.id] != null).length : 0),
    [matrix, devId],
  );
  const complete = filled === CATEGORIES.length;

  function handleChange(categoryId: string, level: SkillLevel) {
    if (!devId) return;
    tracker.current.change(devId, categoryId);
    setMatrix((current) => {
      logger.log("cell_change", {
        devId,
        categoryId,
        from: current[devId]?.[categoryId] ?? null,
        to: level,
        meta: { block },
      });
      return setCell(current, devId, categoryId, level);
    });
  }

  /** Demo helper: fills the current person only. */
  function fillDefault() {
    if (!devId) return;
    setMatrix((current) => {
      let next = cloneMatrix(current);
      for (const category of CATEGORIES) {
        const pick = SKILL_LEVELS[Math.floor(Math.random() * SKILL_LEVELS.length)];
        tracker.current.open(devId, category.id);
        tracker.current.change(devId, category.id);
        next = setCell(next, devId, category.id, pick);
      }
      return next;
    });
    logger.log("cell_change", { meta: { action: "default_fill", task: 1, block } });
  }

  async function submit() {
    if (!sessionId || !devId) return;
    setBusy(true);
    setError(null);
    clientSession.addElapsed(1, logger.elapsed());
    const durationMs = clientSession.getElapsed(1);
    const committedAt = nowIsoMs();
    // Only this person's row, so the log gets one set of cells per block.
    const interactions = tracker.current.buildTask1Rows({
      sessionId,
      participantId: participantId || "unknown",
      matrix: developerMatrix(matrix, devId),
      committedAt,
    });

    logger.log("task_submit", { meta: { task: 1, durationMs, block, devId } });
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
          startedAt: clientSession.getStart(1, startedAt.current),
          interactions,
          recalculate: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Saving failed");
      clientSession.setTask1(matrix);
      clientSession.setSuggestions(data.suggestions ?? []);
      if (data.prefill) clientSession.setPrefill(data.prefill);
      // Person to person stays on the same route, so the client router would
      // re-render this component without unmounting it: the loading overlay
      // would stay up and the interaction tracker would carry one person's
      // cells into the next. A full load gives every person a clean start.
      window.location.assign(afterOwn(block));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
      setBusy(false);
    }
  }

  if (!ready || !developer || !devId) {
    return (
      <div className="page page--wide">
        <LoadingSpinner fullPage label="Loading …" />
        <Steps current={1} />
      </div>
    );
  }

  return (
    <div className="page page--wide">
      {busy && <LoadingSpinner fullPage label="Saving …" />}
      <Steps current={1} detail={`Person ${block + 1} of ${BLOCK_COUNT}`} />
      <StudyBanner />

      <div className="t1">
        <PersonCard
          className="span2"
          developer={developer}
          position={`person ${block + 1} of ${BLOCK_COUNT}`}
          right={
            <>
              <button type="button" className="btn btn--ghost btn--sm" onClick={fillDefault}>
                Default
              </button>
              <button
                type="button"
                className="btn btn--sm"
                disabled={!complete || busy}
                onClick={submit}
              >
                {busy
                  ? "Saving …"
                  : isLastBlock(block)
                    ? "Continue to the overview →"
                    : "Next person →"}
              </button>
            </>
          }
        />

        <div className="rail">
          <div className="card">
            <LevelGuide open compact />
          </div>
        </div>

        <div className="card">
          <h3>What the records show</h3>
          <EvidencePanel
            devId={devId}
            categoryId={selected}
            onEvidenceOpen={() =>
              logger.log("evidence_open", {
                devId,
                categoryId: selected ?? undefined,
                meta: { block, task: 1 },
              })
            }
          />
          <p className="small muted">
            {filled} of {CATEGORIES.length} competences rated.
          </p>
        </div>

        <div className="card">
          <h3>Set a level for each competence</h3>
          <p className="small muted" style={{ marginTop: -6 }}>
            Select a competence to read its records on the left. No suggestions in this
            step — you will see the same people again in Task 2.
          </p>
          <CompetenceList
            devId={devId}
            matrix={matrix}
            selected={selected}
            onSelect={(categoryId) => {
              setSelected(categoryId);
              logger.log("cell_open", { devId, categoryId, meta: { block } });
            }}
            onOpen={(categoryId) => tracker.current.open(devId, categoryId)}
            onChange={handleChange}
          />

          {error && <p className="error">{error}</p>}

          <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
            {filled} of {CATEGORIES.length} rated.
            {!complete && (
              <>
                {" "}
                Rate every competence to continue — use <b>n/o</b> where the records show nothing.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
