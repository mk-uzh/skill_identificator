"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientSession } from "@/lib/client-session";
import { ORG_CONFIG } from "@/lib/org-config";
import { projectInfo } from "@/lib/project";
import { useProject } from "@/lib/project-context";
import { CATEGORIES, LEVEL_ANCHORS_SHORT } from "@/lib/study-config";
import { LEVEL_SCALE_SOURCE } from "@/lib/taxonomy";
import { BLOCK_COUNT, ownHref } from "@/lib/study-flow";
import {
  ORDERED_LEVELS,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_SHORT,
} from "@/lib/types";

export default function IntroPage() {
  const router = useRouter();
  const { project } = useProject();
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
        body: JSON.stringify({ participantCode: code.trim(), consent, project }),
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
    <div className="page page--intro">
      <div className="intro">
      <div className="intro__main">
      <section className="hero">
        <p className="crumb">Study on assessing skills from public project records</p>
        <h1 className="title title--xl">Read the records. Rate what they show.</h1>
        <p className="lede">
          You will look at {BLOCK_COUNT} developers of {projectInfo(project).full} and say, for
          each of {CATEGORIES.length} competences, how far their work reaches. No technical
          knowledge needed.
        </p>
      </section>

      <div className="flow3">
        <div className="card flow3__i">
          <span className="flow3__n">1</span>
          <h3>Rate on your own</h3>
          <p>One competence at a time. You read what the person did, then pick a level.</p>
        </div>
        <div className="card flow3__i">
          <span className="flow3__n">2</span>
          <h3>Compare</h3>
          <p>The same people again, now with a suggested level. Accept it, adjust it or keep yours.</p>
        </div>
        <div className="card flow3__i">
          <span className="flow3__n">3</span>
          <h3>Answer four questions</h3>
          <p>A short wrap-up about how it felt.</p>
        </div>
      </div>

      <div className="card">
        <h3>The levels</h3>
        <div className="scale scale--static">
          {ORDERED_LEVELS.map((level) => (
            <div key={level} className="lvtile lvtile--static">
              <b>{SKILL_LEVEL_SHORT[level]}</b>
              <small>{SKILL_LEVEL_LABELS[level]}</small>
              <span className="lvtile__tip">{LEVEL_ANCHORS_SHORT[level]}</span>
            </div>
          ))}
          <div className="lvtile lvtile--static lvtile--na">
            <b>n/o</b>
            <small>Nothing in the records</small>
          </div>
        </div>
        <p className="meaning">
          <b>n/o, not observable.</b> The records show nothing about this competence. That is
          information, not a gap in your judgement.
        </p>
        <details className="about about--flat">
          <summary>
            <span className="about__name">Where the records come from</span>
            <span className="about__text">GitHub for the code, Jira for the tasks</span>
          </summary>
          <div className="about__body">
            <div>
              <b>GitHub</b>
              <p>Every change with its note, the code itself, proposals and how others reviewed them.</p>
            </div>
            <div>
              <b>Jira</b>
              <p>Tasks and fault reports, the discussion around them and how they ended.</p>
            </div>
            <div className="about__wide">
              <b>Not visible in them</b>
              <p>{ORG_CONFIG.blind_spots.join(". ")}.</p>
            </div>
          </div>
        </details>
      </div>

      </div>

      <div className="intro__side">
      <div className="card">
        <h3>Before you start</h3>
        <div className="field">
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
            You get the code from the study team.
          </p>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I agree that my ratings and my clicks in this interface are recorded under the participant
            code. No names, e-mail or IP addresses are stored, and the developers appear under
            pseudonyms. I can stop at any time.
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <span />
          <button
            type="button"
            className="btn"
            disabled={!code.trim() || !consent || busy}
            onClick={start}
          >
            {busy ? "Starting …" : "Start →"}
          </button>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
