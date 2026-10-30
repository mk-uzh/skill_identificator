"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SkillRadar } from "@/components/SkillRadar";
import { BottomBar } from "@/components/BottomBar";
import { clientSession } from "@/lib/client-session";
import { cloneMatrix, coalesceMatrix } from "@/lib/matrix";
import { futureWork, labelOf, roleFits } from "@/lib/roles";
import { useProject } from "@/lib/project-context";
import { CATEGORIES } from "@/lib/study-config";
import { BLOCK_COUNT, developerOrder, ownHref } from "@/lib/study-flow";
import {
  SKILL_LEVEL_SHORT,
  SKILL_LEVEL_VALUE,
  type Matrix,
  type SuggestionOutcome,
} from "@/lib/types";

const DECISION_LABEL: Record<string, string> = {
  accepted_unchanged: "accepted",
  adjusted: "adjusted",
  rejected: "rejected",
  open: "left open",
};

const DECISION_CLASS: Record<string, string> = {
  accepted_unchanged: "ok",
  adjusted: "warn",
  rejected: "bad",
  open: "muted",
};

function lvl(value: string | null | undefined): string {
  return value ? SKILL_LEVEL_SHORT[value as keyof typeof SKILL_LEVEL_SHORT] ?? "–" : "–";
}

export default function SummaryPage() {
  const router = useRouter();
  const [task1, setTask1] = useState<Matrix | null>(null);
  const [task2, setTask2] = useState<Matrix | null>(null);
  const [outcomes, setOutcomes] = useState<SuggestionOutcome[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [tab, setTab] = useState<string>("all");
  const [show, setShow] = useState<"both" | "before" | "after">("both");
  const [error, setError] = useState<string | null>(null);
  const [shortened, setShortened] = useState(false);

  useEffect(() => {
    const id = clientSession.getSessionId();
    if (!id) {
      router.replace("/");
      return;
    }
    setOrder(developerOrder(clientSession.getParticipantCode() ?? ""));

    void (async () => {
      try {
        const res = await fetch(`/api/session?sessionId=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (res.ok && !data.task2Submitted) {
          const done = new Set(clientSession.getOutcomes().map((o) => o.devId)).size;
          router.replace(ownHref(Math.min(done, BLOCK_COUNT - 1)));
          return;
        }
        if (res.ok && data.task1Matrix && data.task2Matrix) {
          const t1 = cloneMatrix(data.task1Matrix as Matrix);
          const t2 = coalesceMatrix(data.task2Matrix as Matrix, t1);
          setTask1(t1);
          setTask2(t2);
          setOutcomes((data.outcomes as SuggestionOutcome[]) ?? clientSession.getOutcomes());
          setShortened(Boolean(data.prototypeSkip));
          setTab(developerOrder(clientSession.getParticipantCode() ?? "")[0] ?? "all");
          return;
        }
      } catch {
        /* fall through to the browser copy */
      }
      const t1 = clientSession.getTask1();
      const t2 = clientSession.getTask2();
      if (!t1 || !t2) {
        setError("Could not load your ratings for the overview.");
        return;
      }
      setTask1(cloneMatrix(t1));
      setTask2(coalesceMatrix(t2, t1));
      setOutcomes(clientSession.getOutcomes());
    })();
  }, [router]);

  const { developers } = useProject();
  const people = useMemo(
    () =>
      order
        .map((id) => developers.find((d) => d.id === id))
        .filter((d): d is (typeof developers)[number] => d != null),
    [order, developers],
  );

  const stats = useMemo(() => {
    const by = (d: string) => outcomes.filter((o) => o.decision === d).length;
    const agreedBefore = outcomes.filter(
      (o) => o.initialValue != null && o.initialValue === o.suggested,
    ).length;
    const naFilled = outcomes.filter(
      (o) => o.initialValue === "not_observable" && o.finalValue !== "not_observable",
    ).length;
    const moved = outcomes
      .map((o) => {
        const a = o.initialValue ? SKILL_LEVEL_VALUE[o.initialValue] : null;
        const b = o.finalValue ? SKILL_LEVEL_VALUE[o.finalValue] : null;
        return a != null && b != null ? b - a : null;
      })
      .filter((v): v is number => v != null);
    const avg = moved.length ? moved.reduce((s, v) => s + v, 0) / moved.length : 0;
    return {
      total: outcomes.length,
      accepted: by("accepted_unchanged"),
      adjusted: by("adjusted"),
      rejected: by("rejected"),
      agreedBefore,
      naFilled,
      avg,
    };
  }, [outcomes]);

  if (error) {
    return (
      <div className="page page--narrow2">
        <div className="card">
          <p className="error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const done = new Set(clientSession.getOutcomes().map((o) => o.devId)).size;
              router.push(ownHref(Math.min(done, BLOCK_COUNT - 1)));
            }}
          >
            Back to where you stopped
          </button>
        </div>
      </div>
    );
  }

  if (!task1 || !task2) {
    return (
      <div className="page page--wide2">
        <p className="muted">Loading the summary …</p>
      </div>
    );
  }

  const devId = tab === "all" ? null : tab;
  const developer = devId ? developers.find((d) => d.id === devId) ?? null : null;

  const fw = devId ? futureWork(task2, devId) : null;
  const fits = devId ? roleFits(task2, devId) : [];

  return (
    <div className="page page--flow page--wide2">
      {shortened && (
        <div className="banner">
          Cut short with the prototype shortcut. The numbers describe only what was decided. The
          session is marked and excluded from the analysis.
        </div>
      )}

      <p className="crumb">After Task 2</p>
      <h1 className="title">Summary</h1>
      <p className="lede">What changed once you saw the system's proposals.</p>

      <div className="seg" role="tablist" aria-label="Person">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={tab === "all" ? "on" : ""}
          onClick={() => setTab("all")}
        >
          Everyone
        </button>
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            role="tab"
            aria-selected={tab === person.id}
            className={tab === person.id ? "on" : ""}
            onClick={() => setTab(person.id)}
          >
            {person.label}
          </button>
        ))}
      </div>

      {tab === "all" && (
        <>
          <div className="stats">
            <div className="stat">
              <b>
                {stats.accepted}
                <small> of {stats.total}</small>
              </b>
              <span>proposals accepted</span>
            </div>
            <div className="stat">
              <b>{stats.adjusted}</b>
              <span>adjusted</span>
            </div>
            <div className="stat">
              <b>{stats.rejected}</b>
              <span>rejected</span>
            </div>
            <div className="stat">
              <b>
                {stats.avg >= 0 ? "+" : ""}
                {stats.avg.toFixed(1)}
              </b>
              <span>average change in level</span>
            </div>
          </div>
          <p className="small muted">
            {stats.agreedBefore} proposals already matched your answer. {stats.naFilled} cells you
            marked n/o now have a level.
          </p>

          <div className="card">
            <h3>Closest occupation per person</h3>
            <table className="clean">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Closest occupation</th>
                  <th className="n">Demonstrated</th>
                  <th>Main gap</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => {
                  const best = roleFits(task2, person.id)[0];
                  return (
                    <tr key={person.id}>
                      <td>
                        <b>{person.label}</b>
                      </td>
                      <td>{best?.role.label ?? "–"}</td>
                      <td className="n">{best ? `${best.demonstrated} of ${best.measured}` : "–"}</td>
                      <td className="muted">
                        {best?.missing.length
                          ? best.missing.map(labelOf).slice(0, 2).join(", ")
                          : "nothing missing"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {developer && devId && fw && (
        <>
          <div className="cols2">
            <div className="card">
              <h3>What changed for {developer.label}</h3>
              <table className="clean">
                <thead>
                  <tr>
                    <th>Competence</th>
                    <th className="n">Task 1</th>
                    <th className="n">Proposed</th>
                    <th className="n">Task 2</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map((category) => {
                    const outcome = outcomes.find(
                      (o) => o.devId === devId && o.categoryId === category.id,
                    );
                    const d = outcome?.decision ?? "open";
                    return (
                      <tr key={category.id}>
                        <td>{category.label}</td>
                        <td className="n">{lvl(task1[devId]?.[category.id])}</td>
                        <td className="n">{lvl(outcome?.suggested)}</td>
                        <td className="n">
                          <b>{lvl(task2[devId]?.[category.id])}</b>
                        </td>
                        <td>
                          <span className={"chipd chipd--" + DECISION_CLASS[d]}>
                            {DECISION_LABEL[d]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>Profile</h3>
              <SkillRadar
                task1={task1}
                task2={task2}
                developerId={devId}
                show={show}
                withTable={false}
              />
              <div className="seg seg--sm" role="group" aria-label="Show">
                {(["both", "before", "after"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={show === mode ? "on" : ""}
                    aria-pressed={show === mode}
                    onClick={() => setShow(mode)}
                  >
                    {mode === "both" ? "Both" : mode === "before" ? "Task 1" : "Task 2"}
                  </button>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                Grey: Task 1. Green: Task 2. n/o sits at the centre.
              </p>
            </div>
          </div>

          <div className="card">
            <h3>Which occupation do the records match?</h3>
            <table className="clean">
              <thead>
                <tr>
                  <th>Occupation (ESCO)</th>
                  <th>Demonstrated</th>
                  <th>Nothing in the records about</th>
                </tr>
              </thead>
              <tbody>
                {fits.map((fit, i) => (
                  <tr key={fit.role.key}>
                    <td>
                      <b>{fit.role.label}</b>
                      {i === 0 && <span className="chipd chipd--ok">closest</span>}
                    </td>
                    <td>
                      {fit.demonstrated} of {fit.measured}
                    </td>
                    <td className="muted">
                      {[...fit.missing.map(labelOf), ...fit.role.essential_not_measured].join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted" style={{ marginTop: 12 }}>
              This shows what the records demonstrate, not what the person is capable of.
            </p>
          </div>

          <div className="stats stats--3">
            <div className="stat stat--text">
              <span>Ready to take on</span>
              <b>{fw.ready.length ? fw.ready.join(", ") : "nothing at level 4 or above"}</b>
            </div>
            <div className="stat stat--text">
              <span>Would grow into</span>
              <b>{fw.grow.length ? fw.grow.join(", ") : "nothing at level 3"}</b>
            </div>
            <div className="stat stat--text">
              <span>Needs a conversation first</span>
              <b>
                {fw.conversation.length ? fw.conversation.join(", ") : "the records cover everything"}
              </b>
            </div>
          </div>
        </>
      )}

      <BottomBar text="Four short questions are left">
        <button type="button" className="btn" onClick={() => router.push("/done")}>
          Go to the questions →
        </button>
      </BottomBar>
    </div>
  );
}
