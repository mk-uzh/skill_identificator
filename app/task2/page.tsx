"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EvidencePanel } from "@/components/EvidencePanel";
import { ConfidenceGuide, LevelGuide } from "@/components/LevelGuide";
import { LevelButtons } from "@/components/LevelButtons";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PersonCard } from "@/components/PersonCard";
import { Steps } from "@/components/Steps";
import { StudyBanner } from "@/components/StudyBanner";
import { CellTracker } from "@/lib/cell-tracker";
import { clientSession } from "@/lib/client-session";
import { nowIsoMs } from "@/lib/interaction-log";
import { logger } from "@/lib/logger";
import {
  cloneMatrix,
  coalesceMatrix,
  developerMatrix,
  emptyMatrix,
  setCell,
} from "@/lib/matrix";
import { CATEGORIES, DEVELOPERS } from "@/lib/study-config";
import { indexSuggestions, suggestionKey } from "@/lib/suggestions";
import {
  afterSystem,
  BLOCK_COUNT,
  blockFromLocation,
  COMPARISON_STEPS,
  developerOrder,
  isLastBlock,
  ownHref,
  systemHref,
} from "@/lib/study-flow";
import {
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_SHORT,
  type AiSuggestion,
  type Matrix,
  type SkillLevel,
  type SuggestionDecision,
  type SuggestionOutcome,
} from "@/lib/types";

function confidenceClass(confidence: number): string {
  if (confidence >= 0.8) return "dot--hi";
  if (confidence >= 0.6) return "dot--mid";
  return "dot--low";
}

function LevelBadge({ level }: { level: SkillLevel | null }) {
  if (!level) return <span className="lv lv--na lv--static lv--big">–</span>;
  return (
    <span className={`lv lv--${level} lv--static lv--big`}>
      {SKILL_LEVEL_SHORT[level]}
    </span>
  );
}

/**
 * The system's view of ONE person, one competence at a time.
 *
 * Second half of a block. The person was rated unaided a moment ago, so the
 * records are still fresh; the comparison walks the competences in place and
 * only writes task 2 after the last person.
 */
export default function Task2Page() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [block, setBlock] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [ci, setCi] = useState(0);
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix);
  const [task1Matrix, setTask1Matrix] = useState<Matrix>(emptyMatrix);
  const [allSuggestions, setAllSuggestions] = useState<AiSuggestion[]>([]);
  const [decisions, setDecisions] = useState<Record<string, SuggestionDecision>>({});
  const [adjusting, setAdjusting] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const tracker = useRef(new CellTracker());
  const startedAt = useRef<string>(nowIsoMs());
  const shownAt = useRef<Record<string, number>>({});
  const decidedAfterMs = useRef<Record<string, number>>({});

  useEffect(() => {
    const id = clientSession.getSessionId();
    const task1 = clientSession.getTask1();
    const stored = clientSession.getSuggestions();
    const code = clientSession.getParticipantCode() ?? "";
    const currentBlock = blockFromLocation();
    const devIds = developerOrder(code);
    const devId = devIds[currentBlock];

    if (!id) {
      router.replace("/");
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/session?sessionId=${encodeURIComponent(id)}`);
        const status = await res.json();
        if (!res.ok || !status.task1Submitted) {
          router.replace(ownHref(currentBlock));
          return;
        }
        if (status.task2Submitted) {
          router.replace("/summary");
          return;
        }
      } catch {
        if (!task1) {
          router.replace(ownHref(currentBlock));
          return;
        }
      }

      if (!task1 || !stored || stored.length === 0) {
        router.replace(ownHref(currentBlock));
        return;
      }

      const mine = stored.filter((s) => s.devId === devId);
      const walk =
        COMPARISON_STEPS === "all"
          ? CATEGORIES.map((c) => c.id).filter((cid) =>
              mine.some((s) => s.categoryId === cid),
            )
          : CATEGORIES.map((c) => c.id).filter((cid) => {
              const s = mine.find((x) => x.categoryId === cid);
              return s != null && task1[devId]?.[cid] !== s.suggested;
            });

      if (walk.length === 0) {
        router.replace(afterSystem(currentBlock));
        return;
      }

      const accumulated = clientSession.getTask2();
      const base = accumulated ? cloneMatrix(accumulated) : cloneMatrix(task1);
      const settled = clientSession.getOutcomes();
      const revisiting = settled.some((o) => o.devId === devId);
      if (!revisiting) {
        for (const s of mine) {
          if (!base[s.devId]) base[s.devId] = {};
          base[s.devId][s.categoryId] = s.suggested;
        }
      }

      const initial: Record<string, SuggestionDecision> = {};
      for (const s of mine) {
        const key = suggestionKey(s.devId, s.categoryId);
        const previous = settled.find(
          (o) => o.devId === s.devId && o.categoryId === s.categoryId,
        );
        const t1 = task1[s.devId]?.[s.categoryId] ?? null;
        initial[key] = previous
          ? previous.decision
          : t1 != null && t1 === s.suggested
            ? "accepted_unchanged"
            : "open";
        shownAt.current[key] = Date.now();
      }

      setSessionId(id);
      setParticipantId(code);
      setBlock(currentBlock);
      setOrder(devIds);
      setSteps(walk);
      setTask1Matrix(cloneMatrix(task1));
      setAllSuggestions(stored);
      setMatrix(base);
      setDecisions(initial);

      startedAt.current = nowIsoMs();
      clientSession.setStartOnce(2, startedAt.current);
      logger.start(id, 2);
      logger.log("task_start", {
        meta: { task: 2, block: currentBlock, devId, competences: walk.length },
      });
      setReady(true);
    })();
  }, [router]);

  const devId = order[block];
  const developer = useMemo(
    () => DEVELOPERS.find((d) => d.id === devId) ?? null,
    [devId],
  );
  const blockSuggestions = useMemo(
    () => allSuggestions.filter((s) => s.devId === devId),
    [allSuggestions, devId],
  );
  const suggestionMap = useMemo(
    () => indexSuggestions(blockSuggestions),
    [blockSuggestions],
  );

  const categoryId = steps[ci] ?? null;
  const category = CATEGORIES.find((c) => c.id === categoryId) ?? null;
  const key = categoryId && devId ? suggestionKey(devId, categoryId) : "";
  const suggestion = key ? suggestionMap.get(key) : undefined;
  const yourLevel = devId && categoryId ? task1Matrix[devId]?.[categoryId] ?? null : null;
  const currentLevel = devId && categoryId ? matrix[devId]?.[categoryId] ?? null : null;
  const decision = decisions[key] ?? "open";

  useEffect(() => {
    if (!ready || !suggestion) return;
    setAdjusting(false);
    if (shownAt.current[key] == null) shownAt.current[key] = Date.now();
    logger.log("suggestion_shown", {
      devId: suggestion.devId,
      categoryId: suggestion.categoryId,
      from: yourLevel,
      suggested: suggestion.suggested,
      meta: { confidence: suggestion.confidence, block, step: ci },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  function markDecided(k: string, d: SuggestionDecision) {
    if (decidedAfterMs.current[k] === undefined) {
      decidedAfterMs.current[k] = Date.now() - (shownAt.current[k] ?? Date.now());
    }
    setDecisions((current) => ({ ...current, [k]: d }));
  }

  type SettledDecision = Exclude<SuggestionDecision, "open">;

  function setLevel(
    level: SkillLevel,
    type: SettledDecision,
    event: "accept" | "dismiss" | "modify",
  ) {
    if (!devId || !categoryId) return;
    tracker.current.open(devId, categoryId);
    tracker.current.change(devId, categoryId);
    tracker.current.setExplicitType(devId, categoryId, type);
    setMatrix((current) => setCell(current, devId, categoryId, level));
    logger.log(
      event === "accept"
        ? "suggestion_accept"
        : event === "dismiss"
          ? "suggestion_dismiss"
          : "suggestion_modify",
      {
        devId,
        categoryId,
        to: level,
        suggested: suggestion?.suggested,
        meta: { block, step: ci },
      },
    );
    markDecided(key, type);
  }

  function handleNote(note: string) {
    if (!devId || !categoryId) return;
    setNotes((current) => ({ ...current, [key]: note }));
    tracker.current.setCorrectionNote(devId, categoryId, note);
  }

  function settleBlock(currentMatrix: Matrix): {
    finalMatrix: Matrix;
    outcomes: SuggestionOutcome[];
  } {
    const finalMatrix = cloneMatrix(currentMatrix);
    const finalDecisions = { ...decisions };
    for (const s of blockSuggestions) {
      const k = suggestionKey(s.devId, s.categoryId);
      const t1 = task1Matrix[s.devId]?.[s.categoryId] ?? null;
      if (!finalMatrix[s.devId]) finalMatrix[s.devId] = {};
      if (finalMatrix[s.devId][s.categoryId] == null) {
        finalMatrix[s.devId][s.categoryId] = t1;
      }
      if (finalDecisions[k] !== "open") continue;
      const value = finalMatrix[s.devId][s.categoryId];
      const type: Exclude<SuggestionDecision, "open"> =
        value === s.suggested
          ? "accepted_unchanged"
          : value === t1
            ? "rejected"
            : "adjusted";
      finalDecisions[k] = type;
      tracker.current.setExplicitType(s.devId, s.categoryId, type);
      tracker.current.open(s.devId, s.categoryId);
    }
    setDecisions(finalDecisions);
    const outcomes: SuggestionOutcome[] = blockSuggestions.map((s) => {
      const k = suggestionKey(s.devId, s.categoryId);
      return {
        devId: s.devId,
        categoryId: s.categoryId,
        suggested: s.suggested,
        veracity: s.veracity,
        initialValue: task1Matrix[s.devId]?.[s.categoryId] ?? null,
        finalValue: finalMatrix[s.devId]?.[s.categoryId] ?? null,
        decision: finalDecisions[k] ?? "open",
        timeToDecisionMs: decidedAfterMs.current[k] ?? null,
        changeCount: tracker.current.getChangeCount(s.devId, s.categoryId),
      };
    });
    return { finalMatrix, outcomes };
  }

  /**
   * Prototype shortcut, as in the design draft: finish task 2 now with what
   * has been decided so far. Cells never seen keep the task 1 value and the
   * session is flagged, so a shortened run cannot be mistaken for a real one.
   */
  async function skipToSummary() {
    if (!sessionId || !devId) return;
    setBusy(true);
    setError(null);
    const { finalMatrix, outcomes } = settleBlock(matrix);
    // Only the competences actually shown become outcomes. Everything after
    // the current step was never on screen, and writing a decision for it
    // would invent data that looks exactly like a real one.
    const seen = new Set(steps.slice(0, ci + 1));
    const merged = clientSession
      .getOutcomes()
      .filter((o) => o.devId !== devId)
      .concat(outcomes.filter((o) => seen.has(o.categoryId)));
    const final = coalesceMatrix(finalMatrix, task1Matrix);
    clientSession.setOutcomes(merged);
    clientSession.setTask2(final);
    clientSession.addElapsed(2, logger.elapsed());
    logger.log("task_submit", { meta: { task: 2, block, devId, prototypeSkip: true } });
    await logger.flush();
    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          task: 2,
          matrix: final,
          durationMs: clientSession.getElapsed(2),
          startedAt: clientSession.getStart(2, startedAt.current),
          suggestions: allSuggestions,
          outcomes: merged,
          interactions: tracker.current.buildTask2Rows({
            sessionId,
            participantId: participantId || "unknown",
            matrix: developerMatrix(final, devId),
            task1: task1Matrix,
            suggestions: suggestionMap,
            committedAt: nowIsoMs(),
          }),
          prototypeSkip: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Saving failed");
      router.push("/summary");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
      setBusy(false);
    }
  }

  async function advance() {
    if (!sessionId || !devId) return;
    if (ci < steps.length - 1) {
      setCi(ci + 1);
      return;
    }
    setBusy(true);
    setError(null);

    const { finalMatrix, outcomes } = settleBlock(matrix);
    setMatrix(finalMatrix);

    clientSession.addElapsed(2, logger.elapsed());
    const durationMs = clientSession.getElapsed(2);
    const committedAt = nowIsoMs();
    const interactions = tracker.current.buildTask2Rows({
      sessionId,
      participantId: participantId || "unknown",
      matrix: developerMatrix(finalMatrix, devId),
      task1: task1Matrix,
      suggestions: suggestionMap,
      committedAt,
    });

    const mergedOutcomes = clientSession
      .getOutcomes()
      .filter((o) => o.devId !== devId)
      .concat(outcomes);
    clientSession.setOutcomes(mergedOutcomes);
    clientSession.setTask2(finalMatrix);

    logger.log("task_submit", { meta: { task: 2, durationMs, block, devId } });
    await logger.flush();

    try {
      if (!isLastBlock(block)) {
        const res = await fetch("/api/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, rows: interactions }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Saving failed");
        }
        // Same route for the next person — reload, see task 1 for why.
        window.location.assign(systemHref(block + 1));
        return;
      }

      const final = coalesceMatrix(finalMatrix, task1Matrix);
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          task: 2,
          matrix: final,
          durationMs,
          startedAt: clientSession.getStart(2, startedAt.current),
          suggestions: allSuggestions,
          outcomes: mergedOutcomes,
          interactions,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Saving failed");
      clientSession.setTask2(final);
      router.push("/summary");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
      setBusy(false);
    }
  }

  if (!ready || !developer || !devId || !category || !suggestion) {
    return (
      <div className="page page--wide">
        <LoadingSpinner fullPage label="Loading the system's view …" />
        <Steps current={3} />
      </div>
    );
  }

  const lastStep = ci === steps.length - 1;
  const lastPerson = isLastBlock(block);
  const confidencePct = Math.round(suggestion.confidence * 100);

  return (
    <div className="page page--wide">
      {busy && <LoadingSpinner fullPage label="Saving …" />}
      <Steps
        current={3}
        detail={`Person ${block + 1} of ${BLOCK_COUNT} · competence ${ci + 1} of ${steps.length}`}
      />
      <StudyBanner />

      <PersonCard developer={developer} position={`person ${block + 1} of ${BLOCK_COUNT}`} />

      <div className="card">
        <div className="card__title-row">
          <h2 style={{ margin: 0 }}>
            {developer.label} – {category.label}
          </h2>
          <span className="person__nav">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={ci === 0 || busy}
              onClick={() => setCi(ci - 1)}
            >
              ← Back
            </button>
            <button type="button" className="btn" disabled={busy} onClick={advance}>
              {!lastStep
                ? "Next competence →"
                : lastPerson
                  ? "Finish →"
                  : "Next person →"}
            </button>
          </span>
        </div>
        <p className="small muted" style={{ marginTop: -4 }}>
          {category.plain}
        </p>

        <div className="foldrow">
          <LevelGuide open={false} />
          <ConfidenceGuide />
        </div>

        <div className="layout">
          <div>
            <div className="half">
              <div className="panel">
                <h3>Your answer</h3>
                <p className="panel__level">
                  <LevelBadge level={yourLevel} />
                  <b>{yourLevel ? SKILL_LEVEL_LABELS[yourLevel] : "not set"}</b>
                </p>
              </div>
              <div className="panel panel--system">
                <h3>What the system proposes</h3>
                <p className="panel__level">
                  <LevelBadge level={suggestion.suggested} />
                  <b>{SKILL_LEVEL_LABELS[suggestion.suggested]}</b>
                  <span className="sug">
                    <span className={`dot ${confidenceClass(suggestion.confidence)}`} />
                    confidence {confidencePct} %
                  </span>
                </p>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <h3>What the records show</h3>
              <p className="small muted" style={{ marginTop: -6 }}>
                The same records you saw in Task 1. The system reads them as{" "}
                <b>{SKILL_LEVEL_LABELS[suggestion.suggested]}</b>.
              </p>
              <EvidencePanel
                devId={devId}
                categoryId={category.id}
                showHeader={false}
                onEvidenceOpen={() =>
                  logger.log("evidence_open", {
                    devId,
                    categoryId: category.id,
                    meta: { block, task: 2 },
                  })
                }
              />
            </div>
          </div>

          <div className="side">
            <div className="panel panel--system">
              <h3>Your decision</h3>
              <button
                type="button"
                className={"btn btn--wide" + (decision === "accepted_unchanged" ? " btn--on" : "")}
                onClick={() => setLevel(suggestion.suggested, "accepted_unchanged", "accept")}
              >
                Accept, set to {SKILL_LEVEL_SHORT[suggestion.suggested]}
              </button>
              <button
                type="button"
                className={"btn btn--ghost btn--wide" + (adjusting ? " btn--on" : "")}
                onClick={() => setAdjusting(!adjusting)}
              >
                Adjust, pick another level
              </button>
              {adjusting && (
                <div style={{ margin: "8px 0" }}>
                  <LevelButtons
                    name={category.label}
                    value={currentLevel}
                    onChange={(level) => setLevel(level, "adjusted", "modify")}
                  />
                </div>
              )}
              <button
                type="button"
                className={"btn btn--ghost btn--wide" + (decision === "rejected" ? " btn--on" : "")}
                disabled={!yourLevel}
                onClick={() => yourLevel && setLevel(yourLevel, "rejected", "dismiss")}
              >
                Keep my answer{yourLevel ? `, stay at ${SKILL_LEVEL_SHORT[yourLevel]}` : ""}
              </button>

              <p className="small" style={{ margin: "14px 0 6px" }}>
                <b>Why, optional</b>
              </p>
              <textarea
                value={notes[key] ?? ""}
                onChange={(e) => handleNote(e.target.value)}
                placeholder="If you disagree, write briefly why. This is recorded with your answer."
              />
            </div>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <p style={{ marginTop: 18 }}>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={skipToSummary}>
            Skip to summary, prototype only
          </button>
          <span className="small muted" style={{ marginLeft: 10 }}>
            Ends the run here and marks the session as a prototype run, excluded from the analysis.
          </span>
        </p>
      </div>
    </div>
  );
}
