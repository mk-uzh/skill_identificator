"use client";

import { Dashboard } from "@/components/Dashboard";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SkillRadar } from "@/components/SkillRadar";
import { BottomBar } from "@/components/BottomBar";
import { clientSession } from "@/lib/client-session";
import { cloneMatrix, coalesceMatrix } from "@/lib/matrix";
import { futureWork, labelOf, roleFits } from "@/lib/roles";
import { InfoTip } from "@/components/InfoTip";

/** How an occupation is matched against the final assessment. Content for an InfoTip. */
function OccupationInfo() {
  return (
    <span className="tipbody">
      <span className="tipbody__p">
        ESCO, the European skills classification, lists for every occupation the competences it
        regards as essential.
      </span>
      <span className="tipbody__p">
        For each occupation we count how many of those essential competences this study measures
        and your final assessment puts at level 2 or higher. Level 1 and not observable do not
        count. The occupation with the highest share is shown as the closest.
      </span>
      <span className="tipbody__p">
        Essential competences the study does not measure are listed as &ldquo;nothing in the
        records about&rdquo;. So a high match never means that the person fits the role. It shows
        what the records demonstrate, not what the person is capable of.
      </span>
    </span>
  );
}
import { useProject } from "@/lib/project-context";
import { CATEGORIES } from "@/lib/study-config";
import { BLOCK_COUNT, developerOrder, ownHref } from "@/lib/study-flow";
import {
  SKILL_LEVEL_SHORT,
  SKILL_LEVEL_VALUE,
  type Matrix,
  type SuggestionOutcome,
  type SurveyAnswers,
  type Task1Answers,
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
  const [survey1, setSurvey1] = useState<Task1Answers | null>(null);
  const [survey2, setSurvey2] = useState<SurveyAnswers | null>(null);
  const [seconds, setSeconds] = useState<{ task: number; devId: string; categoryId: string; seconds: number }[]>([]);
  const [showSeconds, setShowSeconds] = useState(false);
  const [filter, setFilter] = useState<"all" | "accepted_unchanged" | "adjusted" | "rejected">("all");
  const [sortBy, setSortBy] = useState<"competence" | "t1" | "proposed" | "t2" | "decision" | "s1" | "s2" | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    const id = clientSession.getSessionId();
    if (!id) {
      router.replace("/");
      return;
    }
    setOrder(clientSession.getDevOrder() ?? developerOrder(clientSession.getParticipantCode() ?? ""));
    try {
      const a = window.sessionStorage.getItem("devskill.survey1");
      const b = window.sessionStorage.getItem("devskill.survey2");
      if (a) setSurvey1(JSON.parse(a) as Task1Answers);
      if (b) setSurvey2(JSON.parse(b) as SurveyAnswers);
    } catch {
      /* storage may be blocked */
    }

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
          setSeconds((data.cellSeconds as typeof seconds) ?? []);
          setShortened(Boolean(data.prototypeSkip));
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

  function finish() {
    try {
      window.sessionStorage.removeItem("devskill.survey1");
      window.sessionStorage.removeItem("devskill.survey2");
    } catch {
      /* ignore */
    }
    clientSession.clear();
    router.push("/done");
  }

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
      (o) =>
        (o.initialValue === "not_observable" || o.initialValue === "cannot_judge") &&
        o.finalValue !== "not_observable" &&
        o.finalValue !== "cannot_judge",
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

  const single = people.length === 1;
  const devId = single ? people[0].id : tab === "all" ? null : tab;
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

      {!single && (
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
      )}

      {(tab === "all" || single) && (
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
            marked n/o or ? now have a level.
          </p>
        </>
      )}

      {developer && devId && fw && (
        <>
          <h3 className="h3-inline" style={{ marginTop: 0 }}>What you said in the questions</h3>
          <Dashboard
            devId={devId}
            task1={task1}
            task2={task2}
            outcomes={outcomes}
            survey1={survey1}
            survey2={survey2}
          />

          <div className="cols2">
            <div className="card">
              <h3>What changed for {developer.label}</h3>
              <div className="ovtools filterbar" role="group" aria-label="Filter by decision" style={{ marginBottom: 8 }}>
                <span className="small muted">Show</span>
                {(
                  [
                    ["all", "All"],
                    ["accepted_unchanged", "Accepted"],
                    ["adjusted", "Adjusted"],
                    ["rejected", "Rejected"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={"btn btn--sm btn--ghost" + (filter === id ? " is-on" : "")}
                    aria-pressed={filter === id}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
                <label className="checkbox ovtools__opt" style={{ marginLeft: "auto" }}>
                  <input type="checkbox" checked={showSeconds} onChange={(e) => setShowSeconds(e.target.checked)} />
                  <span>Show seconds</span>
                </label>
              </div>
              <table className="clean">
                <thead>
                  <tr>
                    {(
                      [
                        ["competence", "Competence", ""],
                        ["t1", "Task 1", "n"],
                        ["proposed", "Proposed", "n"],
                        ["t2", "Task 2", "n"],
                        ["decision", "Decision", ""],
                        ...(showSeconds
                          ? ([
                              ["s1", "Sec. T1", "n"],
                              ["s2", "Sec. T2", "n"],
                            ] as const)
                          : []),
                      ] as const
                    ).map(([key, label, cls]) => (
                      <th
                        key={key}
                        className={cls + " sortable"}
                        aria-sort={sortBy === key ? (sortAsc ? "ascending" : "descending") : "none"}
                      >
                        <button
                          type="button"
                          className="sortbtn"
                          onClick={() => {
                            if (sortBy === key) setSortAsc(!sortAsc);
                            else {
                              setSortBy(key);
                              setSortAsc(true);
                            }
                          }}
                        >
                          {label}
                          <span aria-hidden="true">{sortBy === key ? (sortAsc ? " ▲" : " ▼") : ""}</span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const num = (l: string | null | undefined) =>
                      l ? SKILL_LEVEL_VALUE[l as keyof typeof SKILL_LEVEL_VALUE] ?? 0 : 0;
                    const order: Record<string, number> = { accepted_unchanged: 0, adjusted: 1, rejected: 2, open: 3 };
                    const secOf = (task: number, cat: string): number | null =>
                      seconds.find((x) => x.task === task && x.devId === devId && x.categoryId === cat)?.seconds ?? null;
                    const rows = CATEGORIES.map((category) => {
                      const outcome = outcomes.find((o) => o.devId === devId && o.categoryId === category.id);
                      return {
                        category,
                        outcome,
                        d: outcome?.decision ?? "open",
                        t1: num(task1[devId]?.[category.id]),
                        proposed: num(outcome?.suggested),
                        t2: num(task2[devId]?.[category.id]),
                        s1: secOf(1, category.id),
                        s2: secOf(2, category.id) ?? (outcome?.timeToDecisionMs != null ? outcome.timeToDecisionMs / 1000 : null),
                      };
                    }).filter((r) => filter === "all" || r.d === filter);
                    if (sortBy) {
                      const dir = sortAsc ? 1 : -1;
                      rows.sort((x, y) => {
                        if (sortBy === "competence") return dir * x.category.label.localeCompare(y.category.label);
                        if (sortBy === "decision") return dir * (order[x.d] - order[y.d]);
                        if (sortBy === "s1" || sortBy === "s2")
                          return dir * ((x[sortBy] ?? Number.MAX_SAFE_INTEGER) - (y[sortBy] ?? Number.MAX_SAFE_INTEGER));
                        return dir * (x[sortBy] - y[sortBy]);
                      });
                    }
                    if (rows.length === 0)
                      return (
                        <tr>
                          <td colSpan={showSeconds ? 7 : 5} className="muted">
                            No cells with this decision.
                          </td>
                        </tr>
                      );
                    return rows.map(({ category, outcome, d, s1, s2 }) => (
                      <tr key={category.id}>
                        <td>{category.label}</td>
                        <td className="n">{lvl(task1[devId]?.[category.id])}</td>
                        <td className="n">{lvl(outcome?.suggested)}</td>
                        <td className="n">
                          <b>{lvl(task2[devId]?.[category.id])}</b>
                        </td>
                        <td>
                          <span className={"chipd chipd--" + DECISION_CLASS[d]}>{DECISION_LABEL[d]}</span>
                        </td>
                        {showSeconds && (
                          <>
                            <td className="n">{s1 != null ? Math.round(s1) : "–"}</td>
                            <td className="n">{s2 != null ? Math.round(s2) : "–"}</td>
                          </>
                        )}
                      </tr>
                    ));
                  })()}
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


          <div className="cols2">
            <div className="card">
              <h3>
                Which occupations do the records match?
                <InfoTip label="How the occupations are matched" wide>
                  <OccupationInfo />
                </InfoTip>
              </h3>
              <p className="small muted" style={{ marginTop: -4 }}>
                Green: essential competence at level 2 or higher. Grey: not shown (n/o, ? or level 1). Not what the person is capable of.
              </p>
              {fits.map((fit, i) => {
                const missing = new Set(fit.missing);
                return (
                  <div className="occ" key={fit.role.key}>
                    <div className="occ__head">
                      <b>
                        {fit.role.label}
                        {i === 0 && <span className="chipd chipd--ok">closest</span>}
                      </b>
                      <span>
                        {fit.demonstrated} of {fit.measured}
                      </span>
                    </div>
                    <div className="occ__bar" role="img" aria-label={`${fit.demonstrated} of ${fit.measured} essential competences demonstrated`}>
                      {[...fit.role.essential_measured].sort((x, y) => Number(missing.has(x)) - Number(missing.has(y))).map((id) => (
                        <i key={id} className={missing.has(id) ? "" : "on"} title={labelOf(id)} />
                      ))}
                    </div>
                    {i === 0 && fit.missing.length > 0 && (
                      <div className="tags tags--small">
                        <span className="small muted">Not shown in the records:</span>
                        {fit.missing.map(labelOf).map((n) => (
                          <span className="tag tag--grey" key={n}>{n}</span>
                        ))}
                      </div>
                    )}
                    {i === 0 && fit.role.essential_not_measured.length > 0 && (
                      <div className="tags tags--small">
                        <span className="small muted">Also essential, but not covered by the competences of this study:</span>
                        {fit.role.essential_not_measured.map((n) => (
                          <span className="tag tag--grey" key={n}>{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="card">
              <h3>
                What the levels suggest for future work
            <InfoTip label="How the three groups are formed" wide>
              <span className="tipbody">
                <span className="tipbody__p">
                  The groups are read straight off your final levels, nothing else is added:
                </span>
                <b>Ready to take on</b>
                <span className="tipbody__p">competences at level 4 or above.</span>
                <b>Would grow into</b>
                <span className="tipbody__p">competences at level 3.</span>
                <b>Needs a conversation first</b>
                <span className="tipbody__p">
                  competences that are not observable: the records say nothing about them, so only a
                  conversation can tell.
                </span>
                <span className="tipbody__p">
                  It is a reading of the records, not a forecast, and it says nothing about what the
                  person wants or is able to do.
                </span>
              </span>
            </InfoTip>
              </h3>
              {(
                [
                  ["Ready to take on", "level 4 or 5", fw.ready, "tag--g1"],
                  ["Would grow into", "level 3", fw.grow, "tag--g2"],
                  ["Needs a conversation first", "not in the records", fw.conversation, "tag--grey"],
                ] as const
              ).map(([title, hint, list, cls]) => (
                <div className="fwgroup" key={title}>
                  <div className="small muted">
                    <b>{title}</b> · {hint}
                  </div>
                  <div className="tags">
                    {list.length ? (
                      list.map((n) => (
                        <span className={"tag " + cls} key={n}>{n}</span>
                      ))
                    ) : (
                      <span className="small muted">none</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </>
      )}

      <BottomBar text="You have seen everything">
        <button type="button" className="btn" onClick={finish}>
          Finish
        </button>
      </BottomBar>
    </div>
  );
}
