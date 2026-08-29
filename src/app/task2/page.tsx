"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DeveloperProfile } from "@/components/DeveloperProfile";
import { Legend } from "@/components/Legend";
import { SkillMatrix } from "@/components/SkillMatrix";
import { Steps } from "@/components/Steps";
import { clientSession } from "@/lib/client-session";
import { logger } from "@/lib/logger";
import { cloneMatrix, emptyMatrix, setCell } from "@/lib/matrix";
import { DEVELOPERS } from "@/lib/study-config";
import { indexSuggestions, suggestionKey } from "@/lib/suggestions";
import type {
  AiSuggestion,
  Matrix,
  SkillLevel,
  SuggestionDecision,
  SuggestionOutcome,
} from "@/lib/types";

export default function Task2Page() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [decisions, setDecisions] = useState<Record<string, SuggestionDecision>>({});
  const [openProfile, setOpenProfile] = useState<string | null>(null);
  const [openRationale, setOpenRationale] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Starting values from task 1 – reference for the analysis. */
  const initialValues = useRef<Record<string, SkillLevel | null>>({});
  /** Point in time when the respective suggestion first became visible. */
  const shownAt = useRef<Record<string, number>>({});
  const decidedAfterMs = useRef<Record<string, number>>({});
  const changeCounts = useRef<Record<string, number>>({});

  useEffect(() => {
    const id = clientSession.getSessionId();
    const task1 = clientSession.getTask1();
    const stored = clientSession.getSuggestions();

    if (!id || !task1 || !stored) {
      router.replace("/");
      return;
    }

    setSessionId(id);
    setMatrix(cloneMatrix(task1));
    setSuggestions(stored);

    const initialDecisions: Record<string, SuggestionDecision> = {};
    for (const suggestion of stored) {
      const key = suggestionKey(suggestion.devId, suggestion.categoryId);
      initialDecisions[key] = "open";
      initialValues.current[key] = task1[suggestion.devId]?.[suggestion.categoryId] ?? null;
      shownAt.current[key] = Date.now();
      changeCounts.current[key] = 0;
    }
    setDecisions(initialDecisions);

    logger.start(id, 2);
    logger.log("task_start", { meta: { task: 2, suggestionCount: stored.length } });
    for (const suggestion of stored) {
      logger.log("suggestion_shown", {
        devId: suggestion.devId,
        categoryId: suggestion.categoryId,
        from: initialValues.current[suggestionKey(suggestion.devId, suggestion.categoryId)],
        suggested: suggestion.suggested,
        meta: { confidence: suggestion.confidence, direction: suggestion.direction },
      });
    }
  }, [router]);

  const suggestionMap = useMemo(() => indexSuggestions(suggestions), [suggestions]);

  function markDecided(key: string, decision: SuggestionDecision) {
    if (decidedAfterMs.current[key] === undefined) {
      decidedAfterMs.current[key] = Date.now() - (shownAt.current[key] ?? Date.now());
    }
    setDecisions((current) => ({ ...current, [key]: decision }));
    setOpenRationale((current) => (current === key ? null : current));
  }

  function handleChange(devId: string, categoryId: string, next: SkillLevel | null) {
    const key = suggestionKey(devId, categoryId);
    setMatrix((current) => {
      logger.log("cell_change", {
        devId,
        categoryId,
        from: current[devId]?.[categoryId] ?? null,
        to: next,
        suggested: suggestionMap.get(key)?.suggested,
      });
      return setCell(current, devId, categoryId, next);
    });

    if (suggestionMap.has(key)) {
      changeCounts.current[key] = (changeCounts.current[key] ?? 0) + 1;
      const suggestion = suggestionMap.get(key)!;
      const decision: SuggestionDecision = next === suggestion.suggested ? "accepted" : "modified";
      logger.log("suggestion_modify", {
        devId,
        categoryId,
        to: next,
        suggested: suggestion.suggested,
        meta: { resultingDecision: decision },
      });
      markDecided(key, decision);
    }
  }

  function handleAccept(suggestion: AiSuggestion) {
    const key = suggestionKey(suggestion.devId, suggestion.categoryId);
    changeCounts.current[key] = (changeCounts.current[key] ?? 0) + 1;
    setMatrix((current) =>
      setCell(current, suggestion.devId, suggestion.categoryId, suggestion.suggested),
    );
    logger.log("suggestion_accept", {
      devId: suggestion.devId,
      categoryId: suggestion.categoryId,
      from: initialValues.current[key],
      to: suggestion.suggested,
      suggested: suggestion.suggested,
    });
    markDecided(key, "accepted");
  }

  /** Expand/collapse the rationale. Logged: interest in the explanation. */
  function handleToggleRationale(suggestion: AiSuggestion) {
    const key = suggestionKey(suggestion.devId, suggestion.categoryId);
    const isOpening = openRationale !== key;
    logger.log(isOpening ? "rationale_open" : "rationale_close", {
      devId: suggestion.devId,
      categoryId: suggestion.categoryId,
      suggested: suggestion.suggested,
    });
    setOpenRationale(isOpening ? key : null);
  }

  function handleDismiss(suggestion: AiSuggestion) {
    const key = suggestionKey(suggestion.devId, suggestion.categoryId);
    logger.log("suggestion_dismiss", {
      devId: suggestion.devId,
      categoryId: suggestion.categoryId,
      from: initialValues.current[key],
      suggested: suggestion.suggested,
    });
    markDecided(key, "dismissed");
  }

  function buildOutcomes(finalMatrix: Matrix): SuggestionOutcome[] {
    return suggestions.map((suggestion) => {
      const key = suggestionKey(suggestion.devId, suggestion.categoryId);
      return {
        devId: suggestion.devId,
        categoryId: suggestion.categoryId,
        suggested: suggestion.suggested,
        veracity: suggestion.veracity,
        initialValue: initialValues.current[key] ?? null,
        finalValue: finalMatrix[suggestion.devId]?.[suggestion.categoryId] ?? null,
        decision: decisions[key] ?? "open",
        timeToDecisionMs: decidedAfterMs.current[key] ?? null,
        changeCount: changeCounts.current[key] ?? 0,
      };
    });
  }

  const openCount = Object.values(decisions).filter((d) => d === "open").length;

  async function submit() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    const durationMs = logger.elapsed();
    logger.log("task_submit", { meta: { task: 2, durationMs, openSuggestions: openCount } });
    await logger.flush();

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          task: 2,
          matrix,
          durationMs,
          suggestions,
          outcomes: buildOutcomes(matrix),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Saving failed");
      router.push("/done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
      setBusy(false);
    }
  }

  const profileDeveloper = DEVELOPERS.find((d) => d.id === openProfile) ?? null;

  return (
    <div className="page page--wide">
      <Steps current={2} />
      <div className="card">
        <h1>Task 2 – assessment with system support</h1>
        <p className="lede">
          Your ratings from Task 1 are pre-filled. Wherever the assessment derived by DevSkill
          differs, you see a suggestion. You can accept it, choose your own value or dismiss it. You
          can also still change all remaining fields.
        </p>

        <SkillMatrix
          matrix={matrix}
          onCellChange={handleChange}
          onCellOpen={(devId, categoryId) => logger.log("cell_open", { devId, categoryId })}
          onProfileOpen={(devId) => {
            setOpenProfile(devId);
            logger.log("profile_open", { devId });
          }}
          suggestions={suggestionMap}
          decisions={decisions}
          onAccept={handleAccept}
          onDismiss={handleDismiss}
          openRationale={openRationale}
          onToggleRationale={handleToggleRationale}
        />

        <Legend />

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <span className="small muted">
            {openCount === 0
              ? "All suggestions handled"
              : `${openCount} of ${suggestions.length} suggestions open`}
          </span>
          <button type="button" className="btn" disabled={busy} onClick={submit}>
            {busy ? "Saving …" : "Finish →"}
          </button>
        </div>
        <p className="small muted" style={{ textAlign: "right", marginTop: 4 }}>
          You can also finish without handling every suggestion.
        </p>
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
