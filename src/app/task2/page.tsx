"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CoveragePanel } from "@/components/CoveragePanel";
import { DeveloperProfile } from "@/components/DeveloperProfile";
import { Legend } from "@/components/Legend";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SkillMatrix } from "@/components/SkillMatrix";
import { Steps } from "@/components/Steps";
import { CellTracker } from "@/lib/cell-tracker";
import { clientSession } from "@/lib/client-session";
import { nowIsoMs } from "@/lib/interaction-log";
import { logger } from "@/lib/logger";
import { cloneMatrix, coalesceMatrix, emptyMatrix, setCell } from "@/lib/matrix";
import { DEVELOPERS } from "@/lib/study-config";
import { indexSuggestions, suggestionKey } from "@/lib/suggestions";
import {
  type AiSuggestion,
  type Matrix,
  type SkillLevel,
  type SuggestionDecision,
  type SuggestionOutcome,
} from "@/lib/types";

export default function Task2Page() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix);
  const [task1Matrix, setTask1Matrix] = useState<Matrix>(emptyMatrix);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [decisions, setDecisions] = useState<Record<string, SuggestionDecision>>({});
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  const [openProfile, setOpenProfile] = useState<string | null>(null);
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);
  const [correctionNotes, setCorrectionNotes] = useState<Record<string, string>>({});
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
    const prefill = clientSession.getPrefill();
    const code = clientSession.getParticipantCode() ?? "";

    if (!id) {
      router.replace("/");
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/session?sessionId=${encodeURIComponent(id)}`);
        const status = await res.json();
        if (!res.ok || !status.task1Submitted) {
          router.replace("/task1");
          return;
        }
        if (status.task2Submitted) {
          router.replace("/summary");
          return;
        }
      } catch {
        if (!task1) {
          router.replace("/task1");
          return;
        }
      }

      if (!task1 || !stored || stored.length === 0) {
        router.replace("/task1");
        return;
      }

      setSessionId(id);
      setParticipantId(code);
      setTask1Matrix(cloneMatrix(task1));
      setSuggestions(stored);
      const fromSuggestions = emptyMatrix();
      for (const s of stored) {
        if (!fromSuggestions[s.devId]) fromSuggestions[s.devId] = {};
        fromSuggestions[s.devId][s.categoryId] = s.suggested;
      }
      setMatrix(prefill ? cloneMatrix(prefill) : fromSuggestions);

      const initialDecisions: Record<string, SuggestionDecision> = {};
      for (const suggestion of stored) {
        const key = suggestionKey(suggestion.devId, suggestion.categoryId);
        const t1 = task1[suggestion.devId]?.[suggestion.categoryId] ?? null;
        // Matching cells start as accepted; differing cells stay open for action.
        initialDecisions[key] =
          t1 != null && t1 === suggestion.suggested ? "accepted_unchanged" : "open";
        shownAt.current[key] = Date.now();
      }
      setDecisions(initialDecisions);

      startedAt.current = nowIsoMs();
      logger.start(id, 2);
      logger.log("task_start", { meta: { task: 2, suggestionCount: stored.length } });
      for (const suggestion of stored) {
        logger.log("suggestion_shown", {
          devId: suggestion.devId,
          categoryId: suggestion.categoryId,
          from: task1[suggestion.devId]?.[suggestion.categoryId] ?? null,
          suggested: suggestion.suggested,
          meta: { confidence: suggestion.confidence },
        });
      }
      setReady(true);
    })();
  }, [router]);

  const suggestionMap = useMemo(() => indexSuggestions(suggestions), [suggestions]);

  const diffCount = useMemo(() => {
    let n = 0;
    for (const s of suggestions) {
      const t1 = task1Matrix[s.devId]?.[s.categoryId] ?? null;
      if (t1 != null && t1 !== s.suggested) n += 1;
    }
    return n;
  }, [suggestions, task1Matrix]);

  function markDecided(key: string, decision: SuggestionDecision) {
    if (decidedAfterMs.current[key] === undefined) {
      decidedAfterMs.current[key] = Date.now() - (shownAt.current[key] ?? Date.now());
    }
    setDecisions((current) => ({ ...current, [key]: decision }));
    if (openEvidence === key) {
      const [devId, categoryId] = key.split("::");
      tracker.current.evidenceClose(devId, categoryId);
      setOpenEvidence(null);
    }
  }

  function handleAccept(suggestion: AiSuggestion) {
    const key = suggestionKey(suggestion.devId, suggestion.categoryId);
    tracker.current.open(suggestion.devId, suggestion.categoryId);
    tracker.current.change(suggestion.devId, suggestion.categoryId);
    tracker.current.setExplicitType(
      suggestion.devId,
      suggestion.categoryId,
      "accepted_unchanged",
    );
    setMatrix((current) =>
      setCell(current, suggestion.devId, suggestion.categoryId, suggestion.suggested),
    );
    logger.log("suggestion_accept", {
      devId: suggestion.devId,
      categoryId: suggestion.categoryId,
      to: suggestion.suggested,
      suggested: suggestion.suggested,
    });
    markDecided(key, "accepted_unchanged");
  }

  function handleReject(suggestion: AiSuggestion) {
    const key = suggestionKey(suggestion.devId, suggestion.categoryId);
    const kept = task1Matrix[suggestion.devId]?.[suggestion.categoryId] ?? null;
    tracker.current.open(suggestion.devId, suggestion.categoryId);
    tracker.current.change(suggestion.devId, suggestion.categoryId);
    tracker.current.setExplicitType(suggestion.devId, suggestion.categoryId, "rejected");
    // Reject keeps the Task 1 rating — every cell stays filled.
    setMatrix((current) => setCell(current, suggestion.devId, suggestion.categoryId, kept));
    logger.log("suggestion_dismiss", {
      devId: suggestion.devId,
      categoryId: suggestion.categoryId,
      to: kept,
      suggested: suggestion.suggested,
    });
    markDecided(key, "rejected");
  }

  function handleChange(devId: string, categoryId: string, next: SkillLevel | null) {
    const key = suggestionKey(devId, categoryId);
    tracker.current.change(devId, categoryId);
    const suggestion = suggestionMap.get(key);
    const kept = next ?? task1Matrix[devId]?.[categoryId] ?? null;
    const type =
      next === null
        ? "rejected"
        : suggestion && kept === suggestion.suggested
          ? "accepted_unchanged"
          : "adjusted";
    tracker.current.setExplicitType(devId, categoryId, type);
    setMatrix((current) => {
      logger.log("cell_change", {
        devId,
        categoryId,
        from: current[devId]?.[categoryId] ?? null,
        to: kept,
        suggested: suggestion?.suggested,
      });
      return setCell(current, devId, categoryId, kept);
    });
    markDecided(key, type);
  }

  function handleCorrectionNote(devId: string, categoryId: string, note: string) {
    const key = suggestionKey(devId, categoryId);
    setCorrectionNotes((current) => ({ ...current, [key]: note }));
    tracker.current.setCorrectionNote(devId, categoryId, note);
  }

  function handleToggleEvidence(suggestion: AiSuggestion) {
    const key = suggestionKey(suggestion.devId, suggestion.categoryId);
    const isOpening = openEvidence !== key;
    if (openEvidence && openEvidence !== key) {
      const [prevDev, prevCat] = openEvidence.split("::");
      tracker.current.evidenceClose(prevDev, prevCat);
      logger.log("evidence_close", { devId: prevDev, categoryId: prevCat });
    }
    if (isOpening) {
      tracker.current.evidenceOpen(suggestion.devId, suggestion.categoryId);
      logger.log("evidence_open", {
        devId: suggestion.devId,
        categoryId: suggestion.categoryId,
        suggested: suggestion.suggested,
      });
      setOpenEvidence(key);
    } else {
      tracker.current.evidenceClose(suggestion.devId, suggestion.categoryId);
      logger.log("evidence_close", {
        devId: suggestion.devId,
        categoryId: suggestion.categoryId,
      });
      setOpenEvidence(null);
    }
  }

  /** Demo helper: accept / reject differing cells in rotation. */
  function fillDefault() {
    let i = 0;
    setMatrix((current) => {
      let next = cloneMatrix(current);
      const nextDecisions: Record<string, SuggestionDecision> = { ...decisions };

      for (const suggestion of suggestions) {
        const key = suggestionKey(suggestion.devId, suggestion.categoryId);
        const t1 = task1Matrix[suggestion.devId]?.[suggestion.categoryId] ?? null;
        const differs = t1 != null && t1 !== suggestion.suggested;
        if (!differs) continue;

        const accept = i % 2 === 0;
        i += 1;
        tracker.current.open(suggestion.devId, suggestion.categoryId);
        tracker.current.change(suggestion.devId, suggestion.categoryId);

        if (accept) {
          next = setCell(next, suggestion.devId, suggestion.categoryId, suggestion.suggested);
          tracker.current.setExplicitType(
            suggestion.devId,
            suggestion.categoryId,
            "accepted_unchanged",
          );
          nextDecisions[key] = "accepted_unchanged";
        } else {
          next = setCell(next, suggestion.devId, suggestion.categoryId, t1);
          tracker.current.setExplicitType(suggestion.devId, suggestion.categoryId, "rejected");
          nextDecisions[key] = "rejected";
        }
      }

      setDecisions(nextDecisions);
      return next;
    });
    logger.log("cell_change", { meta: { action: "default_fill", task: 2 } });
  }

  function buildOutcomes(finalMatrix: Matrix): SuggestionOutcome[] {
    return suggestions.map((suggestion) => {
      const key = suggestionKey(suggestion.devId, suggestion.categoryId);
      return {
        devId: suggestion.devId,
        categoryId: suggestion.categoryId,
        suggested: suggestion.suggested,
        veracity: suggestion.veracity,
        initialValue: task1Matrix[suggestion.devId]?.[suggestion.categoryId] ?? null,
        finalValue: finalMatrix[suggestion.devId]?.[suggestion.categoryId] ?? null,
        decision: decisions[key] ?? "open",
        timeToDecisionMs: decidedAfterMs.current[key] ?? null,
        changeCount: tracker.current.getChangeCount(suggestion.devId, suggestion.categoryId),
      };
    });
  }

  const openCount = Object.values(decisions).filter((d) => d === "open").length;

  async function submit() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    const durationMs = logger.elapsed();
    const committedAt = nowIsoMs();

    // Every cell must stay filled: null (Reject / cleared) falls back to Task 1.
    const finalMatrix = coalesceMatrix(matrix, task1Matrix);

    const finalDecisions = { ...decisions };
    for (const suggestion of suggestions) {
      const key = suggestionKey(suggestion.devId, suggestion.categoryId);
      if (finalDecisions[key] === "open") {
        const value = finalMatrix[suggestion.devId]?.[suggestion.categoryId] ?? null;
        const t1 = task1Matrix[suggestion.devId]?.[suggestion.categoryId] ?? null;
        if (value === suggestion.suggested) {
          finalDecisions[key] = "accepted_unchanged";
          tracker.current.setExplicitType(
            suggestion.devId,
            suggestion.categoryId,
            "accepted_unchanged",
          );
        } else if (value === t1) {
          finalDecisions[key] = "rejected";
          tracker.current.setExplicitType(suggestion.devId, suggestion.categoryId, "rejected");
        } else {
          finalDecisions[key] = "adjusted";
          tracker.current.setExplicitType(suggestion.devId, suggestion.categoryId, "adjusted");
        }
        tracker.current.open(suggestion.devId, suggestion.categoryId);
      }
    }
    setDecisions(finalDecisions);
    setMatrix(finalMatrix);

    const interactions = tracker.current.buildTask2Rows({
      sessionId,
      participantId: participantId || "unknown",
      matrix: finalMatrix,
      task1: task1Matrix,
      suggestions: suggestionMap,
      committedAt,
    });

    logger.log("task_submit", { meta: { task: 2, durationMs, openSuggestions: openCount } });
    await logger.flush();

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          task: 2,
          matrix: finalMatrix,
          durationMs,
          startedAt: startedAt.current,
          suggestions,
          outcomes: buildOutcomes(finalMatrix),
          interactions,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Saving failed");
      clientSession.setTask2(finalMatrix);
      router.push("/summary");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
      setBusy(false);
    }
  }

  const profileDeveloper = DEVELOPERS.find((d) => d.id === openProfile) ?? null;

  if (!ready) {
    return (
      <div className="page page--wide">
        <LoadingSpinner fullPage label="Loading Task 2 …" />
        <Steps current={2} />
      </div>
    );
  }

  return (
    <div className="page page--wide">
      {busy && <LoadingSpinner fullPage label="Saving …" />}
      <Steps current={2} />
      <div className="card">
        <div className="card__title-row">
          <h1>Task 2 – assessment with system support</h1>
          <button type="button" className="btn btn--ghost" onClick={fillDefault}>
            Default
          </button>
        </div>
        <p className="lede lede--full">
          Differing cells show you → system (e.g. none → basic 90%) with Accept or Reject. Matching cells stay compact — click one to edit, open evidence or add a note.
        </p>
        <p className="small muted" style={{ marginTop: -12, marginBottom: 16 }}>
          {diffCount} differing cell{diffCount === 1 ? "" : "s"} highlighted · {openCount} still open
        </p>

        <CoveragePanel />

        <SkillMatrix
          mode="task2"
          matrix={matrix}
          task1Matrix={task1Matrix}
          onCellChange={handleChange}
          onCellOpen={(devId, categoryId) => {
            tracker.current.open(devId, categoryId);
            logger.log("cell_open", { devId, categoryId });
          }}
          onProfileOpen={(devId) => {
            setOpenProfile(devId);
            logger.log("profile_open", { devId });
          }}
          suggestions={suggestionMap}
          decisions={decisions}
          onAccept={handleAccept}
          onReject={handleReject}
          openEvidence={openEvidence}
          onToggleEvidence={handleToggleEvidence}
          expandedCells={expandedCells}
          onToggleExpand={(devId, categoryId) => {
            const key = suggestionKey(devId, categoryId);
            setExpandedCells((c) => ({ ...c, [key]: !c[key] }));
          }}
          correctionNotes={correctionNotes}
          onCorrectionNoteChange={handleCorrectionNote}
        />

        <Legend />

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => router.push("/task1")}
          >
            ← Back to Task 1
          </button>
          <button type="button" className="btn" disabled={busy} onClick={submit}>
            {busy ? "Saving …" : "Finish →"}
          </button>
        </div>
        <p className="small muted" style={{ textAlign: "right", marginTop: 4 }}>
          Going back lets you change Task 1; continuing recalculates Task 2 suggestions.
        </p>
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
