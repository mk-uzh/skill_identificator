"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InfoTip } from "@/components/InfoTip";
import { CompetenceGuide, LevelGuide } from "@/components/LevelGuide";
import { clientSession } from "@/lib/client-session";
import { ORG_CONFIG } from "@/lib/org-config";
import { projectInfo } from "@/lib/project";
import { useProject } from "@/lib/project-context";
import { CATEGORIES } from "@/lib/study-config";
import { BLOCK_COUNT, ownHref } from "@/lib/study-flow";

function CompetenceTerm() {
  return (
    <InfoTip
      term={<b><i>{CATEGORIES.length} competences</i></b>}
      label="The competences"
      wide
    >
      <CompetenceGuide />
    </InfoTip>
  );
}

function LevelTerm({ text = "level" }: { text?: string }) {
  return (
    <InfoTip term={<b><i>{text}</i></b>} label="The levels" wide>
      <LevelGuide bare />
      <span className="tipbody__p" style={{ marginTop: 8 }}>
        <b>n/o, not observable.</b> The records show nothing about this competence. That is
        information, not a gap in your judgement.
      </span>
    </InfoTip>
  );
}

export default function IntroPage() {
  const router = useRouter();
  const { project } = useProject();
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantCode: code.trim(), consent, terms, project }),
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
          You will look at {BLOCK_COUNT} developers of {projectInfo(project).full} and say,
          for each of the <CompetenceTerm />, how far their work reaches, based on <LevelTerm text="levels" />. No technical
          knowledge needed.
        </p>
      </section>

      <div className="flow3">
        <div className="card flow3__i">
          <span className="flow3__n">1</span>
          <h3>Task 1: rate on your own</h3>
          <p>
            You see {BLOCK_COUNT} developers, one after the other. For each of the{" "}
            <CompetenceTerm /> you read what the public records show (changes,
            reviews, tasks) and pick the <LevelTerm /> you think fits. An overview then shows all your
            ratings side by side, and you can still correct them there.
          </p>
        </div>
        <div className="card flow3__i">
          <span className="flow3__n">2</span>
          <h3>Task 2: compare with the system</h3>
          <p>
            The same developers again, with the same records. For every competence the system
            proposes a level with a short reason and a confidence. You accept it, adjust it or keep
            your own answer.
          </p>
        </div>
        <div className="card flow3__i">
          <span className="flow3__n">3</span>
          <h3>Summary and four questions</h3>
          <p>
            A summary shows what changed between your answers and the proposals, and which
            occupations the records match. Four short questions about how it felt close the study.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>About {projectInfo(project).label}</h3>
        <p>{projectInfo(project).background}</p>
        <p className="small muted" style={{ marginBottom: 0 }}>
          The developers appear under pseudonyms. You do not need to know the project or the
          people: judge only what the records show.
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
        <div className="terms" role="note">
          <h4>{ORG_CONFIG.terms.heading}</h4>
          <ul>
            {ORG_CONFIG.terms.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>{ORG_CONFIG.terms.confirm}</span>
        </label>
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
            disabled={!code.trim() || !consent || !terms || busy}
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
