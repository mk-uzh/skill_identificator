"use client";

import type { ParticipantProfile } from "@/lib/types";
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

function PField({ id, label, value, options, onChange }: {
  id: string; label: string; value: string; options: [string, string][]; onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select …</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
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
  const [step, setStep] = useState<"intro" | "form">("intro");
  const [profile, setProfile] = useState<ParticipantProfile>({
    role: "",
    roleOther: "",
    teamSize: "",
    experienceYears: "",
    codingExperience: "",
    toolExperience: "",
  });
  const profileComplete =
    Boolean(profile.role) &&
    (profile.role !== "other" || Boolean(profile.roleOther?.trim())) &&
    Boolean(profile.teamSize) &&
    Boolean(profile.experienceYears) &&
    Boolean(profile.codingExperience) &&
    Boolean(profile.toolExperience);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantCode: code.trim(), consent, terms, project, profile }),
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
      {step === "intro" && (
      <div className="intro__main">
      <section className="hero">
        <p className="crumb">Study on assessing skills from public project records</p>
        <h1 className="title title--xl">Read the records. Rate what they show.</h1>
        <p className="lede">
          You will look at {BLOCK_COUNT} developers of {projectInfo(project).full} and say,
          for each of the <CompetenceTerm />, how far their work reaches, based on <LevelTerm text="levels" />. You do not need to know the
          project or the people.
        </p>
      </section>

      <div className="flow3">
        <div className="card flow3__i">
          <span className="flow3__n">1</span>
          <h3>Rate on your own</h3>
          <p>
            {BLOCK_COUNT} developers, <CompetenceTerm />, based on <LevelTerm text="levels" />.
            <InfoTip label="More explanations">
              You see the developers one after the other. For each competence you read what the
              public records show (changes, reviews, tasks) and pick the level you think fits. An
              overview then shows all your ratings side by side, and you can still correct them there.
            </InfoTip>
          </p>
        </div>
        <div className="card flow3__i">
          <span className="flow3__n">2</span>
          <h3>Compare with the system</h3>
          <p>
            Same developers, same records, now with a proposal.
            <InfoTip label="More explanations">
              For every competence the system proposes a level with a short reason and a confidence.
              You accept it, adjust it or keep your own answer.
            </InfoTip>
          </p>
        </div>
        <div className="card flow3__i">
          <span className="flow3__n">3</span>
          <h3>Summary and questions</h3>
          <p>
            What changed, and a few questions.
            <InfoTip label="More explanations">
              A summary shows what changed between your answers and the proposals, and which
              occupations the records match. A few short questions about how it felt close the study.
            </InfoTip>
          </p>
        </div>
      </div>

      <div className="card">
        <h3>About the project</h3>
        <p>{projectInfo(project).background}</p>
        <p className="small muted" style={{ marginBottom: 0 }}>
          The developers appear under pseudonyms. Judge only what the records show.
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


      <div className="actions">
        <span />
        <button type="button" className="btn" onClick={() => setStep("form")}>
          Continue →
        </button>
      </div>
      </div>
      )}
      {step === "form" && (
      <div className="intro__side">
      <div className="card">
        <div className="cardhead">
          <h3>Before you start</h3>
        {process.env.NODE_ENV !== "production" && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                const pick = (o: string[]) => o[Math.floor(Math.random() * o.length)];
                setCode("TEST" + Math.floor(Math.random() * 900 + 100));
                setProfile({
                  role: pick(["it_manager", "team_lead", "project_manager", "product_owner"]),
                  roleOther: "",
                  teamSize: pick(["1-5", "6-10", "11-20", ">20"]),
                  experienceYears: pick(["<2", "2-5", "6-10", ">10"]),
                  codingExperience: pick(["never", "past", "occasional", "regular"]),
                  toolExperience: pick(["none", "seen", "used"]),
                });
                setTerms(true);
                setConsent(true);
              }}
            >
              Fill in randomly (testing only)
            </button>
          )}
        </div>
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
        <div className="profile">
          <h4>About you</h4>
          <PField id="role" label="Your role" value={profile.role}
            options={[["it_manager","IT manager"],["team_lead","Team lead"],["project_manager","Project manager"],["product_owner","Product owner"],["other","Other"]]}
            onChange={(v) => setProfile((x) => ({ ...x, role: v }))} />
          {profile.role === "other" && (
            <div className="field">
              <input type="text" aria-label="Other role" placeholder="Your role" value={profile.roleOther ?? ""}
                onChange={(e) => setProfile((x) => ({ ...x, roleOther: e.target.value }))} />
            </div>
          )}
          <PField id="teamSize" label="People you lead or coordinate" value={profile.teamSize}
            options={[["1-5","1–5"],["6-10","6–10"],["11-20","11–20"],[">20","More than 20"]]}
            onChange={(v) => setProfile((x) => ({ ...x, teamSize: v }))} />
          <PField id="experienceYears" label="Years of experience in this kind of role" value={profile.experienceYears}
            options={[["<2","Less than 2"],["2-5","2–5"],["6-10","6–10"],[">10","More than 10"]]}
            onChange={(v) => setProfile((x) => ({ ...x, experienceYears: v }))} />
          <PField id="codingExperience" label="Your own programming experience" value={profile.codingExperience}
            options={[["never","None"],["past","In the past"],["occasional","Currently, occasionally"],["regular","Currently, regularly"]]}
            onChange={(v) => setProfile((x) => ({ ...x, codingExperience: v }))} />
          <PField id="toolExperience" label="Experience with skill matrices or people-analytics tools" value={profile.toolExperience}
            options={[["none","None"],["seen","Seen one"],["used","Have used one"]]}
            onChange={(v) => setProfile((x) => ({ ...x, toolExperience: v }))} />
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
          <button type="button" className="btn btn--ghost" onClick={() => setStep("intro")}>
            ← Back
          </button>
          <button
            type="button"
            className="btn"
            disabled={!code.trim() || !consent || !terms || !profileComplete || busy}
            onClick={start}
          >
            {busy ? "Starting …" : "Start →"}
          </button>
        </div>
      </div>
      </div>
      )}
      </div>
    </div>
  );
}
