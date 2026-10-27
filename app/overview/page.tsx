"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LevelButtons } from "@/components/LevelButtons";
import { LevelGuide } from "@/components/LevelGuide";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Steps } from "@/components/Steps";
import { clientSession } from "@/lib/client-session";
import { nowIsoMs } from "@/lib/interaction-log";
import { logger } from "@/lib/logger";
import { cloneMatrix, emptyMatrix, setCell } from "@/lib/matrix";
import { CATEGORIES, DEVELOPERS, groupedCategories } from "@/lib/study-config";
import { developerOrder, systemHref } from "@/lib/study-flow";
import {
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_SHORT,
  type Matrix,
  type SkillLevel,
} from "@/lib/types";

/**
 * Everything entered in task 1, side by side, still editable.
 *
 * This is the last point at which a rating is made without having seen any
 * suggestion, so corrections here are still part of the unaided baseline.
 * After this screen the system's view appears and the baseline is fixed.
 */
export default function OverviewPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix);
  const [sel, setSel] = useState<{ devId: string; categoryId: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<string>(nowIsoMs());

  useEffect(() => {
    const id = clientSession.getSessionId();
    const code = clientSession.getParticipantCode() ?? "";
    if (!id) {
      router.replace("/");
      return;
    }
    const task1 = clientSession.getTask1();
    if (!task1) {
      router.replace("/task1?block=0");
      return;
    }
    setSessionId(id);
    setOrder(developerOrder(code));
    setMatrix(cloneMatrix(task1));
    startedAt.current = nowIsoMs();
    logger.start(id, 1);
    logger.log("task_start", { meta: { task: 1, screen: "overview" } });
    setReady(true);
  }, [router]);

  const people = useMemo(
    () =>
      order
        .map((id) => DEVELOPERS.find((d) => d.id === id))
        .filter((d): d is (typeof DEVELOPERS)[number] => d != null),
    [order],
  );

  const missing = useMemo(() => {
    let n = 0;
    for (const person of people) {
      for (const category of CATEGORIES) {
        if (matrix[person.id]?.[category.id] == null) n += 1;
      }
    }
    return n;
  }, [matrix, people]);

  function change(level: SkillLevel) {
    if (!sel) return;
    setMatrix((current) => {
      logger.log("cell_change", {
        devId: sel.devId,
        categoryId: sel.categoryId,
        from: current[sel.devId]?.[sel.categoryId] ?? null,
        to: level,
        meta: { screen: "overview" },
      });
      return setCell(current, sel.devId, sel.categoryId, level);
    });
  }

  async function submit() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    const durationMs = clientSession.getElapsed(1);
    logger.log("task_submit", { meta: { task: 1, screen: "overview", durationMs } });
    await logger.flush();
    try {
      // Re-submit task 1 so any correction made here is the baseline, and
      // take the suggestions that task 2 will work from.
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          task: 1,
          matrix,
          durationMs,
          startedAt: clientSession.getStart(1, startedAt.current),
          recalculate: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Saving failed");
      clientSession.setTask1(matrix);
      clientSession.setSuggestions(data.suggestions ?? []);
      if (data.prefill) clientSession.setPrefill(data.prefill);
      router.push(systemHref(0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="page page--wide">
        <LoadingSpinner fullPage label="Loading …" />
        <Steps current={2} />
      </div>
    );
  }

  const selCategory = sel ? CATEGORIES.find((c) => c.id === sel.categoryId) : null;

  return (
    <div className="page page--wide">
      {busy && <LoadingSpinner fullPage label="Preparing Task 2 …" />}
      <Steps current={2} />

      <div className="card">
        <h1>Your assessment so far</h1>
        <p className="small muted" style={{ marginTop: -8 }}>
          Click a cell to change it. <b>n/o</b> means the records showed nothing about that
          competence for that person.
        </p>

        <div className="ovwrap">
          <table className="ovmatrix">
            <thead>
              <tr>
                <th className="ovmatrix__rowhead">Competence</th>
                {people.map((person) => (
                  <th key={person.id}>{person.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedCategories().map(({ group, items }) => (
                <Fragment key={group.id}>
                  <tr className="ovmatrix__group">
                    <td colSpan={people.length + 1}>{group.label}</td>
                  </tr>
                  {items.map((category) => (
                    <tr key={category.id}>
                      <td className="ovmatrix__rowhead">{category.label}</td>
                      {people.map((person) => {
                        const value = matrix[person.id]?.[category.id] ?? null;
                        const active =
                          sel?.devId === person.id && sel?.categoryId === category.id;
                        return (
                          <td key={person.id}>
                            <button
                              type="button"
                              title={value ? SKILL_LEVEL_LABELS[value] : "not rated"}
                              className={
                                "lv " +
                                (value ? `lv--${value}` : "lv--na") +
                                (active ? " lv--on" : "")
                              }
                              onClick={() =>
                                setSel({ devId: person.id, categoryId: category.id })
                              }
                            >
                              {value ? SKILL_LEVEL_SHORT[value] : "–"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {sel && selCategory && (
          <div className="panel" style={{ marginTop: 16 }}>
            <h3>
              {sel.devId} · {selCategory.label}
            </h3>
            <LevelButtons name={selCategory.label} value={matrix[sel.devId]?.[sel.categoryId] ?? null} onChange={change} />
          </div>
        )}

        <div className="foldrow">
          <LevelGuide open={false} />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <span className="small muted">
            {missing === 0 ? "Everything rated" : `${missing} still missing`}
          </span>
          <button type="button" className="btn" disabled={busy || missing > 0} onClick={submit}>
            {busy ? "Saving …" : "Continue to Task 2 →"}
          </button>
        </div>
      </div>
    </div>
  );
}
