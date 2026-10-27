"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Steps } from "@/components/Steps";
import { clientSession } from "@/lib/client-session";
import { ORG_CONFIG } from "@/lib/org-config";
import { CATEGORIES, DEVELOPERS, LEVEL_ANCHORS } from "@/lib/study-config";
import { LEVEL_SCALE_SOURCE } from "@/lib/taxonomy";
import { ownHref } from "@/lib/study-flow";
import {
  ORDERED_LEVELS,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_SHORT,
} from "@/lib/types";

export default function IntroPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantCode: code.trim(), consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unknown error");
      clientSession.clear();
      clientSession.setSessionId(data.sessionId);
      clientSession.setParticipantCode(code.trim());
      router.push(ownHref(0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
      setBusy(false);
    }
  }

  return (
    <div className="page page--wide">
      <Steps current={0} />

      <div className="card">
        <h1>The project you will be looking at</h1>
        <p>
          A learning platform that universities run for their courses: assignments, quizzes,
          marking, grades. Hundreds of people have worked on it, and everything they did is
          public. You do not need to know the software, and nothing you are asked is technical.
        </p>
      </div>

      <div className="card">
        <h2>What you will be doing</h2>
        <p>
          You will look at six of these developers and estimate, per competence,
          how far the records show they have worked in that area.
        </p>
        <table>
          <tbody>
            <tr>
              <th style={{ width: 150 }}>Step</th>
              <th>What happens</th>
            </tr>
            <tr>
              <td>
                <b>Task 1</b>
              </td>
              <td>
                Six developers, one after another. For each one you read a short account of what
                the person actually did, and you set a level per competence, on your own.
              </td>
            </tr>
            <tr>
              <td>
                <b>Overview</b>
              </td>
              <td>Everything you entered, side by side. You can still correct it.</td>
            </tr>
            <tr>
              <td>
                <b>Task 2</b>
              </td>
              <td>
                The same six people again, this time with a suggested level and its reasoning.
                You accept it, adjust it or keep your own answer.
              </td>
            </tr>
            <tr>
              <td>
                <b>Summary</b>
              </td>
              <td>
                What changed, which role the evidence matches, and four short questions.
              </td>
            </tr>
          </tbody>
        </table>
        <p className="src">
          About 25 minutes. Nothing is stored under your name.
        </p>
      </div>

      <div className="card">
        <h2>The five levels</h2>
        <p>
          You judge what the records show about one competence, not the person. Each level assumes
          the one below it.
        </p>
        <table className="lvtab">
          <tbody>
            <tr>
              <th style={{ width: 70 }}>Level</th>
              <th style={{ width: "26%" }}>In short</th>
              <th>What that looks like in the records</th>
            </tr>
            {ORDERED_LEVELS.map((level) => (
              <tr key={level}>
                <td>
                  <span className={`lv lv--${level} lv--static`}>
                    {SKILL_LEVEL_SHORT[level]}
                  </span>
                </td>
                <td>
                  <b>{SKILL_LEVEL_LABELS[level]}</b>
                </td>
                <td>{LEVEL_ANCHORS[level]}</td>
              </tr>
            ))}
            <tr>
              <td>
                <span className="lv lv--na lv--static">
                  {SKILL_LEVEL_SHORT.not_observable}
                </span>
              </td>
              <td>
                <b>{SKILL_LEVEL_LABELS.not_observable}</b>
              </td>
              <td>{LEVEL_ANCHORS.not_observable}</td>
            </tr>
          </tbody>
        </table>
        <p className="src">The scale follows the {LEVEL_SCALE_SOURCE}.</p>
      </div>

      <div className="card">
        <h2>Where the information comes from</h2>
        <div className="half">
          <div className="panel">
            <h3>GitHub, the code</h3>
            <table className="sm">
              <tbody>
                <tr>
                  <td style={{ width: "40%" }}>
                    <b>Changes</b>
                  </td>
                  <td>Every edit, with the note the author wrote about it</td>
                </tr>
                <tr>
                  <td>
                    <b>The edited code</b>
                  </td>
                  <td>The lines added or removed: the work itself, not only its description</td>
                </tr>
                <tr>
                  <td>
                    <b>Proposals</b>
                  </td>
                  <td>A set of changes offered for acceptance into the project</td>
                </tr>
                <tr>
                  <td>
                    <b>Inspections</b>
                  </td>
                  <td>Others read a proposal and either approve it or ask for rework</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h3>Jira, the tasks</h3>
            <table className="sm">
              <tbody>
                <tr>
                  <td style={{ width: "40%" }}>
                    <b>Tasks</b>
                  </td>
                  <td>Fault reports, improvement requests, new features, each described</td>
                </tr>
                <tr>
                  <td>
                    <b>Area</b>
                  </td>
                  <td>Which part of the platform it belongs to, quizzes or grading say</td>
                </tr>
                <tr>
                  <td>
                    <b>Discussion</b>
                  </td>
                  <td>What people wrote while working on it, and how a fault was diagnosed</td>
                </tr>
                <tr>
                  <td>
                    <b>Outcome</b>
                  </td>
                  <td>Whether it was fixed, rejected or turned out not to be a fault</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="src">
          <b>Not visible in them:</b> {ORG_CONFIG.blind_spots.join(". ")}. Where the records are
          silent, answer <b>not observable</b> — {CATEGORIES.length} competences are rated per
          person.
        </p>
      </div>

      <div className="card">
        <h2>Data protection</h2>
        <p className="small">
          We record your ratings as well as your interactions with the interface (changes,
          timestamps, how you handle the suggestions). The analysis is pseudonymised via the
          participant code; no names, email addresses or IP addresses are stored. The developers
          you assess are shown under pseudonyms as well. You may end your participation at any
          time without giving reasons.
        </p>

        <div className="field" style={{ marginTop: 20 }}>
          <label htmlFor="code">Participant code</label>
          <input
            id="code"
            type="text"
            value={code}
            placeholder="e.g. P07"
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
          <p className="small muted" style={{ marginTop: 6 }}>
            You receive the code from the study team.
          </p>
        </div>

        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I have read the information and consent to the described processing of my data.
            </span>
          </label>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <span />
          <button
            type="button"
            className="btn"
            disabled={!code.trim() || !consent || busy}
            onClick={start}
          >
            {busy ? "Starting …" : "Start Task 1 →"}
          </button>
        </div>
      </div>
    </div>
  );
}
