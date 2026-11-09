"use client";

import { FoldCard } from "@/components/FoldCard";
import { EvidencePanel } from "@/components/EvidencePanel";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomBar } from "@/components/BottomBar";
import { RatingPanel } from "@/components/RatingPanel";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { clientSession } from "@/lib/client-session";
import { nowIsoMs } from "@/lib/interaction-log";
import { logger } from "@/lib/logger";
import { cloneMatrix, emptyMatrix, setCell } from "@/lib/matrix";
import { useProject } from "@/lib/project-context";
import { CATEGORIES, groupedCategories } from "@/lib/study-config";
import { developerOrder, systemHref } from "@/lib/study-flow";
import {
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_SHORT,
  SKILL_LEVEL_VALUE,
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
  const [focus, setFocus] = useState<string | null>(null);
  const [orderByFocus, setOrderByFocus] = useState(false);
  const [hideNo, setHideNo] = useState(false);
  const [highlight, setHighlight] = useState(false);
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

  const { developers } = useProject();
  const people = useMemo(
    () =>
      order
        .map((id) => developers.find((d) => d.id === id))
        .filter((d): d is (typeof developers)[number] => d != null),
    [order, developers],
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

  const valueOf = (devId: string, categoryId: string) => {
    const level = matrix[devId]?.[categoryId] ?? null;
    return level ? SKILL_LEVEL_VALUE[level] : null;
  };
  const maxOf = (devId: string) =>
    Math.max(0, ...CATEGORIES.map((c) => valueOf(devId, c.id) ?? 0));

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
      </div>
    );
  }

  const selCategory = sel ? CATEGORIES.find((c) => c.id === sel.categoryId) : null;

  return (
    <div className="page page--flow page--wide2">
      {busy && <LoadingSpinner fullPage label="Preparing Task 2 …" />}

      <p className="crumb">Between the two tasks</p>
      <h1 className="title">Your assessment so far</h1>
      <p className="lede">
        The last chance to change something before the suggestions appear.
      </p>

      <div className="ovgrid">
      <div className="card">
        <div className="ovtools" role="group" aria-label="Focus, order and filter">
          <span className="small muted">Focus on</span>
          <button type="button" className={"btn btn--sm btn--ghost" + (focus === null ? " is-on" : "")} onClick={() => { setFocus(null); setOrderByFocus(false); }}>
            Everyone
          </button>
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={"btn btn--sm btn--ghost" + (focus === person.id ? " is-on" : "")}
              onClick={() => {
                setFocus(person.id);
                logger.log("cell_open", { devId: person.id, meta: { screen: "overview", action: "focus" } });
              }}
            >
              {person.label}
            </button>
          ))}
        </div>
        <div className="ovtools">
          <label className="checkbox ovtools__opt">
            <input
              type="checkbox"
              checked={orderByFocus}
              disabled={focus === null}
              onChange={(e) => setOrderByFocus(e.target.checked)}
            />
            <span>Highest level of the focused person first</span>
          </label>
          <label className="checkbox ovtools__opt">
            <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
            <span>Mark each person&apos;s highest level</span>
          </label>
          <label className="checkbox ovtools__opt">
            <input type="checkbox" checked={hideNo} onChange={(e) => setHideNo(e.target.checked)} />
            <span>Hide competences rated n/o</span>
          </label>
        </div>
        <div className="ovchart">
          {groupedCategories().map(({ group, items: unsorted }) => {
            const shown = unsorted.filter((c) =>
              hideNo
                ? (focus ? [focus] : people.map((p) => p.id)).some((id) => (valueOf(id, c.id) ?? 0) > 0)
                : true,
            );
            const items =
              orderByFocus && focus
                ? [...shown].sort((x, y) => (valueOf(focus, y.id) ?? 0) - (valueOf(focus, x.id) ?? 0))
                : shown;
            if (items.length === 0) return null;
            return (
              <Fragment key={group.id}>
                <h4 className="ovchart__group">{group.label}</h4>
                {items.map((category) => (
                  <div className="ovrow" key={category.id}>
                    <div className="ovrow__name">{category.label}</div>
                    <div className="ovrow__bars">
                      {people.map((person) => {
                        const value = matrix[person.id]?.[category.id] ?? null;
                        const n = valueOf(person.id, category.id) ?? 0;
                        const active = sel?.devId === person.id && sel?.categoryId === category.id;
                        const top = highlight && n > 0 && n === maxOf(person.id);
                        return (
                          <button
                            key={person.id}
                            type="button"
                            title={value ? SKILL_LEVEL_LABELS[value] : "not rated"}
                            aria-label={`${person.label}, ${category.label}: ${
                              value ? SKILL_LEVEL_LABELS[value] : "not rated"
                            }`}
                            className={
                              "ovb " +
                              (value ? `ovb--${value}` : "ovb--na") +
                              (active ? " ovb--on" : "") +
                              (top ? " ovb--top" : "") +
                              (focus && focus !== person.id ? " ovb--dim" : "")
                            }
                            onClick={() => setSel({ devId: person.id, categoryId: category.id })}
                          >
                            <span className="ovb__who">{person.label}</span>
                            <span className="ovb__track">
                              <span className="ovb__fill" style={{ width: `${n * 20}%` }} />
                            </span>
                            <span className="ovb__lv">{value ? SKILL_LEVEL_SHORT[value] : "–"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="ovgrid__side">
      {sel && selCategory ? (
        <>
        <div className="card">
          <h3>
            {people.find((p) => p.id === sel.devId)?.label ?? sel.devId}: {selCategory.label}
          </h3>
          {selCategory.description && <p className="small muted">{selCategory.description}</p>}
          <RatingPanel
            name={selCategory.label}
            value={matrix[sel.devId]?.[sel.categoryId] ?? null}
            onChange={change}
          />
        </div>
        <FoldCard title="What the records show">
          <EvidencePanel
            devId={sel.devId}
            categoryId={sel.categoryId}
            onEvidenceOpen={() =>
              logger.log("evidence_open", {
                devId: sel.devId,
                categoryId: sel.categoryId,
                meta: { screen: "overview", task: 1 },
              })
            }
          />
        </FoldCard>
        </>
      ) : (
        <div className="card">
          <h3>Pick a cell</h3>
          <p className="muted">Click any number to change it.</p>
        </div>
      )}
      </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <BottomBar text={missing === 0 ? "Everything rated" : `${missing} still missing`}>
        <button type="button" className="btn" disabled={busy || missing > 0} onClick={submit}>
          {busy ? "Saving …" : "Continue to Task 2 →"}
        </button>
      </BottomBar>
    </div>
  );
}
