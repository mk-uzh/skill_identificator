"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EvidencePanel } from "@/components/EvidencePanel";
import { BottomBar } from "@/components/BottomBar";
import { FlowBar } from "@/components/FlowBar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PersonLine } from "@/components/PersonLine";
import { Rail, type RailItem } from "@/components/Rail";
import { RatingPanel } from "@/components/RatingPanel";
import { CellTracker } from "@/lib/cell-tracker";
import { clientSession } from "@/lib/client-session";
import { nowIsoMs } from "@/lib/interaction-log";
import { logger } from "@/lib/logger";
import { cloneMatrix, developerMatrix, emptyMatrix, setCell } from "@/lib/matrix";
import { CATEGORIES, CATEGORY_GROUPS, DEVELOPERS } from "@/lib/study-config";
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
  const [ci, setCi] = useState(0);
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
  const category = CATEGORIES[ci] ?? CATEGORIES[0];
  const selected = category?.id ?? null;
  const lastStep = ci === CATEGORIES.length - 1;
  const currentLevel = devId && category ? matrix[devId]?.[category.id] ?? null : null;
  const firstOpen = devId
    ? CATEGORIES.findIndex((c) => matrix[devId]?.[c.id] == null)
    : -1;

  // Opening a competence is an event of its own, because reading the records
  // before rating is what the study is about.
  useEffect(() => {
    if (!ready || !devId || !selected) return;
    tracker.current.open(devId, selected);
    logger.log("cell_open", { devId, categoryId: selected, meta: { block, step: ci } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ci, ready, devId]);

  function go(next: number) {
    setCi(Math.max(0, Math.min(CATEGORIES.length - 1, next)));
  }

  // 1-5 and N rate, arrow keys move. Not while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") go(ci + 1);
      else if (e.key === "ArrowLeft") go(ci - 1);
      else if (/^[1-5]$/.test(e.key)) handleChange(selected ?? "", `l${e.key}` as SkillLevel);
      else if (e.key.toLowerCase() === "n") handleChange(selected ?? "", "not_observable");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ci, selected, devId, busy]);

  const chips: RailItem[] = CATEGORIES.map((c, i) => ({
    id: c.id,
    label: c.label,
    state:
      i === ci ? "current" : devId && matrix[devId]?.[c.id] != null ? "done" : "todo",
  }));

  function handleChange(categoryId: string, level: SkillLevel) {
    if (!devId || !categoryId || busy) return;
    tracker.current.open(devId, categoryId);
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
    go(CATEGORIES.length - 1);
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
      </div>
    );
  }

  const remaining = CATEGORIES.length - filled;
  const nextLabel = lastStep
    ? isLastBlock(block)
      ? "Continue to the overview →"
      : "Next person →"
    : "Next competence →";

  return (
    <div className="page page--flow">
      {busy && <LoadingSpinner fullPage label="Saving …" />}
      <FlowBar
        phase="Task 1: your own view"
        personLabel={developer.label}
        personIndex={block}
        personCount={BLOCK_COUNT}
        right={
          <button type="button" className="btn btn--ghost btn--sm" onClick={fillDefault}>
            Fill randomly (demo)
          </button>
        }
      />

      <div className="shell shell--3">
        <Rail
          title={`Competences of ${developer.label}`}
          items={chips}
          hint={complete ? "All rated" : `${remaining} still to rate`}
          onJump={go}
        />

        <section>
          <p className="crumb">
            {CATEGORY_GROUPS.find((g) => g.id === category.groupId)?.label}
          </p>
          <h1 className="title">{category.label}</h1>
          <p className="lede">{category.plain}.</p>

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
          </div>

          <div className="card">
            <h3>Your level</h3>
            <RatingPanel
              name={category.label}
              value={currentLevel}
              onChange={(level) => handleChange(category.id, level)}
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>

        </section>

        <PersonLine developer={developer} />
      </div>

      <BottomBar
        text={
          lastStep && !complete
            ? `${remaining} not rated yet`
            : `Competence ${ci + 1} of ${CATEGORIES.length}`
        }
        onBack={() => go(ci - 1)}
        backDisabled={ci === 0 || busy}
      >
        {lastStep && !complete && firstOpen >= 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => go(firstOpen)}>
            Go to the first open one
          </button>
        )}
        {lastStep ? (
          <button type="button" className="btn" disabled={!complete || busy} onClick={submit}>
            {busy ? "Saving …" : nextLabel}
          </button>
        ) : (
          <button
            type="button"
            className={"btn" + (currentLevel ? "" : " btn--quiet")}
            disabled={busy}
            onClick={() => go(ci + 1)}
          >
            {nextLabel}
          </button>
        )}
      </BottomBar>
    </div>
  );
}
