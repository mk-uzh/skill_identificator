"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SkillRadar } from "@/components/SkillRadar";
import { Steps } from "@/components/Steps";
import { clientSession } from "@/lib/client-session";
import { cloneMatrix, coalesceMatrix } from "@/lib/matrix";
import { futureWork, labelOf, roleFits } from "@/lib/roles";
import { CATEGORIES, DEVELOPERS } from "@/lib/study-config";
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

  const people = useMemo(
    () =>
      order
        .map((id) => DEVELOPERS.find((d) => d.id === id))
        .filter((d): d is (typeof DEVELOPERS)[number] => d != null),
    [order],
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
      <div className="page page--narrow">
        <Steps current={4} />
        <div className="card">
          <p className="error">{error}</p>
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
      <div className="page page--wide">
        <Steps current={4} />
        <div className="card">
          <p className="muted">Loading the summary …</p>
        </div>
      </div>
    );
  }

  const devId = tab === "all" ? null : tab;
  const developer = devId ? DEVELOPERS.find((d) => d.id === devId) ?? null : null;

  return (
    <div className="page page--wide">
      <Steps current={4} />

      {shortened && (
        <div className="banner">
          This run was cut short from the prototype shortcut. Most competences were never shown,
          so the numbers below describe only what was actually decided. The session is marked and
          excluded from the analysis.
        </div>
      )}

      <div className="card">
        <h1>Summary</h1>
        <p style={{ margin: 0 }}>
          <span
            className={"tab" + (tab === "all" ? " tab--on" : "")}
            onClick={() => setTab("all")}
          >
            All {BLOCK_COUNT} people
          </span>
          {people.map((person) => (
            <span
              key={person.id}
              className={"tab" + (tab === person.id ? " tab--on" : "")}
              onClick={() => setTab(person.id)}
            >
              {person.label}
            </span>
          ))}
        </p>
      </div>

      {developer && devId && (
        <>
          <div className="card">
            <h2>{developer.label}</h2>
            <div className="cols2">
              <div>
                <h3>What changed</h3>
                <table>
                  <tbody>
                    <tr>
                      <th style={{ textAlign: "left" }}>Competence</th>
                      <th className="n">Task 1</th>
                      <th className="n">Proposed</th>
                      <th className="n">Task 2</th>
                      <th>Decision</th>
                    </tr>
                    {CATEGORIES.map((category) => {
                      const outcome = outcomes.find(
                        (o) => o.devId === devId && o.categoryId === category.id,
                      );
                      return (
                        <tr key={category.id}>
                          <td>{category.label}</td>
                          <td className="n">{lvl(task1[devId]?.[category.id])}</td>
                          <td className="n">{lvl(outcome?.suggested)}</td>
                          <td className="n">{lvl(task2[devId]?.[category.id])}</td>
                          <td className={DECISION_CLASS[outcome?.decision ?? "open"]}>
                            {DECISION_LABEL[outcome?.decision ?? "open"]}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ marginTop: 12 }}>
                  {(["both", "before", "after"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={
                        "btn btn--ghost btn--sm" + (show === mode ? " btn--on" : "")
                      }
                      onClick={() => setShow(mode)}
                    >
                      {mode === "both" ? "Both" : mode === "before" ? "Task 1 only" : "Task 2 only"}
                    </button>
                  ))}
                </p>
              </div>
              <div>
                <h3>Profile</h3>
                <SkillRadar
                  task1={task1}
                  task2={task2}
                  developerId={devId}
                  show={show}
                  withTable={false}
                />
                <p className="small muted">
                  Grey, your assessment in Task 1. Green, after Task 2. Competences you marked as
                  not observable sit at the centre: there is no honest radius for them.
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Which role does the evidence for {developer.label} match</h2>
            <p className="small">
              ESCO, the European classification of occupations, lists the competences it considers
              essential for each occupation. Your final assessment is compared against those lists.
              The result says what the records demonstrate, not what the person is capable of.
            </p>
            <table>
              <tbody>
                <tr>
                  <th style={{ textAlign: "left", width: "24%" }}>Occupation</th>
                  <th style={{ width: "22%" }}>Demonstrated</th>
                  <th>Nothing in the records about</th>
                </tr>
                {roleFits(task2, devId).map((fit, i) => (
                  <tr key={fit.role.key}>
                    <td>
                      <b>{fit.role.label}</b>
                      {i === 0 && <div className="small muted">closest match</div>}
                    </td>
                    <td>
                      <b>
                        {fit.demonstrated} of {fit.measured}
                      </b>{" "}
                      essential competences measured here
                    </td>
                    <td className="small muted">
                      {[...fit.missing.map(labelOf), ...fit.role.essential_not_measured].join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="src">
              Only those essential competences that this taxonomy measures are counted. The
              occupations also require work this kind of record cannot show, which is listed on the
              right and is not the same as saying the person cannot do it.
            </p>

            <h3 style={{ marginTop: 22 }}>What this suggests for future work</h3>
            {(() => {
              const fw = futureWork(task2, devId);
              return (
                <table>
                  <tbody>
                    <tr>
                      <td style={{ width: "34%" }}>
                        <b>Ready to take on</b>
                      </td>
                      <td>
                        {fw.ready.length ? fw.ready.join(", ") : "nothing at level 4 or above"}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Would grow into</b>
                      </td>
                      <td>{fw.grow.length ? fw.grow.join(", ") : "nothing at level 3"}</td>
                    </tr>
                    <tr>
                      <td>
                        <b>Needs a conversation first</b>
                      </td>
                      <td>
                        {fw.conversation.length
                          ? fw.conversation.join(", ")
                          : "the records cover every competence"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>
        </>
      )}

      {tab === "all" && (
        <div className="card">
          <h2>All {BLOCK_COUNT} people</h2>
          <div className="half">
            <table>
              <tbody>
                <tr>
                  <td>Suggestions accepted</td>
                  <td className="n">
                    <b>{stats.accepted}</b> of {stats.total}
                  </td>
                </tr>
                <tr>
                  <td>Adjusted</td>
                  <td className="n">{stats.adjusted}</td>
                </tr>
                <tr>
                  <td>Rejected</td>
                  <td className="n">{stats.rejected}</td>
                </tr>
                <tr>
                  <td>Already in agreement before the suggestion</td>
                  <td className="n">{stats.agreedBefore}</td>
                </tr>
              </tbody>
            </table>
            <table>
              <tbody>
                <tr>
                  <td>Cells you left as not observable, now filled</td>
                  <td className="n">{stats.naFilled}</td>
                </tr>
                <tr>
                  <td>Average change in level</td>
                  <td className="n">
                    {stats.avg >= 0 ? "+" : ""}
                    {stats.avg.toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 22 }}>Closest role per person</h3>
          <table>
            <tbody>
              <tr>
                <th style={{ textAlign: "left" }}>Person</th>
                <th>Closest occupation</th>
                <th>Demonstrated</th>
                <th>Main gap</th>
              </tr>
              {people.map((person) => {
                const best = roleFits(task2, person.id)[0];
                return (
                  <tr key={person.id}>
                    <td>
                      <b>{person.label}</b>
                    </td>
                    <td>{best?.role.label ?? "–"}</td>
                    <td>
                      {best ? `${best.demonstrated} of ${best.measured}` : "–"}
                    </td>
                    <td className="small muted">
                      {best?.missing.length
                        ? best.missing.map(labelOf).slice(0, 2).join(", ")
                        : "nothing measured here is missing"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>Four short questions</h2>
        <p>
          <button type="button" className="btn" onClick={() => router.push("/done")}>
            Go to the questions →
          </button>
        </p>
      </div>
    </div>
  );
}
