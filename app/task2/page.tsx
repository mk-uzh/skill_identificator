"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EvidencePanel } from "@/components/EvidencePanel";
import { ConfidenceGuide } from "@/components/LevelGuide";
import { RatingPanel } from "@/components/RatingPanel";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { BottomBar } from "@/components/BottomBar";
import { FlowBar } from "@/components/FlowBar";
import { PersonLine } from "@/components/PersonLine";
import { Rail, type RailItem } from "@/components/Rail";
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
import { SKILL_LEVELS } from "@/lib/types";
import { useProject } from "@/lib/project-context";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/study-config";
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
  SKILL_LEVEL_VALUE,
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
  const { developers } = useProject();
  const developer = useMemo(
    () => developers.find((d) => d.id === devId) ?? null,
    [developers, devId],
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

  /** Demo shortcut: decides every competence of this person at random, then jumps to the last one. */
  function fillRandom() {
    if (!devId) return;
    let nextMatrix = cloneMatrix(matrix);
    const nextDecisions = { ...decisions };
    for (const cid of steps) {
      const s = suggestionMap.get(suggestionKey(devId, cid));
      if (!s) continue;
      const k = suggestionKey(devId, cid);
      const t1 = task1Matrix[devId]?.[cid] ?? null;
      const r = Math.random();
      let level: SkillLevel = s.suggested;
      if (t1 != null && r >= 0.5 && r < 0.75) level = t1;
      else if (t1 != null && r >= 0.75) level = SKILL_LEVELS[Math.floor(Math.random() * SKILL_LEVELS.length)];
      const type: Exclude<SuggestionDecision, "open"> =
        level === s.suggested ? "accepted_unchanged" : level === t1 ? "rejected" : "adjusted";
      tracker.current.open(devId, cid);
      tracker.current.change(devId, cid);
      tracker.current.setExplicitType(devId, cid, type);
      if (decidedAfterMs.current[k] === undefined) {
        decidedAfterMs.current[k] = Date.now() - (shownAt.current[k] ?? Date.now());
      }
      nextMatrix = setCell(nextMatrix, devId, cid, level);
      nextDecisions[k] = type;
    }
    setMatrix(nextMatrix);
    setDecisions(nextDecisions);
    setCi(steps.length - 1);
    logger.log("cell_change", { meta: { action: "default_fill", task: 2, block } });
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
      </div>
    );
  }

  const lastStep = ci === steps.length - 1;
  const lastPerson = isLastBlock(block);
  const confidencePct = Math.round(suggestion.confidence * 100);
  const settledCount = steps.filter((cid) => {
    const k = suggestionKey(devId, cid);
    return (decisions[k] ?? "open") !== "open";
  }).length;
  const items: RailItem[] = steps.map((cid, i) => {
    const k = suggestionKey(devId, cid);
    return {
      id: cid,
      label: CATEGORIES.find((c) => c.id === cid)?.label ?? cid,
      state: i === ci ? "current" : (decisions[k] ?? "open") !== "open" ? "done" : "todo",
    };
  });
  const nextLabel = !lastStep ? "Next competence →" : lastPerson ? "Finish →" : "Next person →";
  const decided = decision !== "open";
  const pos = (level: SkillLevel | null) => {
    const v = level ? SKILL_LEVEL_VALUE[level] : null;
    return v != null ? (v - 1) * 25 : null;
  };
  const youPos = pos(yourLevel);
  const sysPos = pos(suggestion.suggested);

  return (
    <div className="page page--flow">
      {busy && <LoadingSpinner fullPage label="Saving …" />}
      <FlowBar
        phase="Task 2: with the system"
        personLabel={developer.label}
        personIndex={block}
        personCount={BLOCK_COUNT}
        right={
          <button type="button" className="btn btn--ghost btn--sm" onClick={fillRandom}>
            Fill randomly (demo)
          </button>
        }
      />

      <div className="shell">
        <Rail
          title={`Competences of ${developer.label}`}
          items={items}
          hint={`${settledCount} of ${steps.length} decided`}
          onJump={(i) => setCi(i)}
        />

        <section>
          <p className="crumb">
            {CATEGORY_GROUPS.find((g) => g.id === category.groupId)?.label}
          </p>
          <h1 className="title">{category.label}</h1>
          <div className="t2grid">
          <div className="t2grid__main">
          <div className="card">
            <div className="cmp">
              <div className="pill">
                <small>You said</small>
                <big>
                  <i>{yourLevel ? SKILL_LEVEL_SHORT[yourLevel] : "–"}</i>
                  {yourLevel ? SKILL_LEVEL_LABELS[yourLevel] : "not set"}
                </big>
              </div>
              <div className="pill pill--sys">
                <small>The system proposes</small>
                <big>
                  <i>{SKILL_LEVEL_SHORT[suggestion.suggested]}</i>
                  {SKILL_LEVEL_LABELS[suggestion.suggested]}
                </big>
                <div className="conf">
                  <span className="conf__bar">
                    <span style={{ width: `${confidencePct}%` }} className={confidenceClass(suggestion.confidence)} />
                  </span>
                  Confidence {confidencePct} %
                </div>
              </div>
            </div>
            {youPos != null && sysPos != null && (
              <>
                <div className="track" aria-hidden="true">
                  <em style={{ left: `${youPos}%` }}>{youPos === sysPos ? "You and system" : "You"}</em>
                  <span className="track__you" style={{ left: `${youPos}%` }} />
                  {youPos !== sysPos && <em className="track__sys-l" style={{ left: `${sysPos}%` }}>System</em>}
                  <span className="track__sys" style={{ left: `${sysPos}%` }} />
                </div>
                <div className="ticks" aria-hidden="true">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h3>What the records show</h3>
            <EvidencePanel
              devId={devId}
              categoryId={category.id}
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

          <div className="t2grid__side">
          <div className="card">
            <h3>Your decision</h3>
            <div className="dec">
              <button
                type="button"
                className={"dec__opt" + (decision === "accepted_unchanged" ? " dec__opt--on" : "")}
                onClick={() => setLevel(suggestion.suggested, "accepted_unchanged", "accept")}
              >
                Accept the proposal <span>Set to {SKILL_LEVEL_SHORT[suggestion.suggested]}</span>
              </button>
              <button
                type="button"
                className={"dec__opt" + (adjusting || decision === "adjusted" ? " dec__opt--on" : "")}
                onClick={() => setAdjusting(!adjusting)}
                aria-expanded={adjusting}
              >
                Adjust <span>Pick another level</span>
              </button>
              {adjusting && (
                <div className="dec__adjust">
                  <RatingPanel
                    name={category.label}
                    value={currentLevel}
                    onChange={(level) => setLevel(level, "adjusted", "modify")}
                  />
                </div>
              )}
              <button
                type="button"
                className={"dec__opt" + (decision === "rejected" ? " dec__opt--on" : "")}
                disabled={!yourLevel}
                onClick={() => yourLevel && setLevel(yourLevel, "rejected", "dismiss")}
              >
                Keep my answer{" "}
                <span>{yourLevel ? `Stay at ${SKILL_LEVEL_SHORT[yourLevel]}` : ""}</span>
              </button>
            </div>
            <label className="why" htmlFor="why">
              Why? <span className="muted">Optional</span>
            </label>
            <textarea
              id="why"
              rows={3}
              value={notes[key] ?? ""}
              onChange={(e) => handleNote(e.target.value)}
              placeholder="If you disagree, write briefly why …"
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>

          <PersonLine developer={developer} />

          <aside className="side">
            <details className="acc">
              <summary>What confidence means</summary>
              <ConfidenceGuide open />
            </details>
          </aside>
          </div>
          </div>

          <p className="proto">
            <button type="button" className="linkbtn" disabled={busy} onClick={skipToSummary}>
              Skip to summary (prototype only)
            </button>{" "}
            <span className="muted">Marks the session as a prototype run, excluded from the analysis.</span>
          </p>
        </section>
      </div>

      <BottomBar
        text={`Competence ${ci + 1} of ${steps.length}`}
        onBack={() => setCi(ci - 1)}
        backDisabled={ci === 0 || busy}
      >
        <button
          type="button"
          className={"btn" + (decided ? "" : " btn--quiet")}
          disabled={busy}
          onClick={advance}
        >
          {nextLabel}
        </button>
      </BottomBar>
    </div>
  );
}
