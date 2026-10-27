"use client";

import { ORG_CONFIG, VISIBILITY_LABELS } from "@/lib/org-config";
import type { Developer } from "@/lib/types";

/** Who is being rated, plus the two declarations that travel with them. */
export function PersonCard({
  developer,
  right,
  position,
  className = "",
}: {
  developer: Developer;
  /** Navigation for this screen, shown top right. */
  right?: React.ReactNode;
  /** "person 3 of 6", shown next to the name as in the design draft. */
  position?: string;
  className?: string;
}) {
  return (
    <div className={`card ${className}`.trim()}>
      <div className="card__title-row">
        <h2 style={{ margin: 0 }}>
          {developer.label}
          {position && (
            <span className="small muted" style={{ fontWeight: 400 }}> , {position}</span>
          )}
        </h2>
        <span className="person__nav">
          <span className="pill">{developer.tenure}</span>
          {right}
        </span>
      </div>
      <p>{developer.profile}</p>

      <div className="foldrow">
        <details className="guide">
          <summary>What is covered</summary>
          <div className="guide__body">
            <p className="small" style={{ marginTop: 0 }}>
              <b>Sources</b>
              <br />
              {ORG_CONFIG.sources.map((s) => `${s.label}: ${s.detail}`).join(". ")}.
            </p>
            <p className="small">
              <b>Period</b>
              <br />
              {ORG_CONFIG.observation_window.label}
            </p>
            <p className="small">
              <b>Activity in the window</b>
              <br />
              {developer.role}.{" "}
              {developer.evidence.join(". ")}.
            </p>
            <p className="small" style={{ marginBottom: 0 }}>
              <b>Not covered</b>
              <br />
              {ORG_CONFIG.blind_spots.join(". ")}.
            </p>
          </div>
        </details>
        <details className="guide">
          <summary>Who can see this</summary>
          <div className="guide__body">
            <p className="small" style={{ marginTop: 0 }}>
              In this study the setting is fixed to{" "}
              <b>{VISIBILITY_LABELS[ORG_CONFIG.visibility]}</b>, so that every participant sees the
              same thing.
            </p>
            <p className="small muted" style={{ marginBottom: 0 }}>
              In real use an organisation chooses one of three settings before the system is
              switched on: the team lead only, the whole team, or the developer and their lead.
              Whichever is chosen is stated on every screen, and the profile never goes to a
              personnel system.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
