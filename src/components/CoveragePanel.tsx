"use client";

import { ORG_CONFIG } from "@/lib/org-config";
import { useVisibility } from "@/lib/visibility-context";

/** Permanently visible on Task 2 — sources, window, blind spots, visibility (DP6, DP7). */
export function CoveragePanel() {
  const { visibility, labels } = useVisibility();

  return (
    <aside className="coverage" aria-label="Coverage and scope">
      <div className="coverage__header">
        <h2 className="coverage__title">Coverage &amp; scope</h2>
        <span className="coverage__visibility" title="Declared visibility regime (DP6)">
          Visibility: {labels[visibility]} (<code>{visibility}</code>)
        </span>
      </div>

      <div className="coverage__grid">
        <div>
          <h3 className="coverage__label">Sources read</h3>
          <ul className="coverage__list">
            {ORG_CONFIG.sources.map((source) => (
              <li key={source.id}>
                <strong>{source.label}</strong> — {source.detail}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="coverage__label">Observation window</h3>
          <p className="coverage__text">{ORG_CONFIG.observation_window.label}</p>
          <p className="coverage__text muted small">
            {ORG_CONFIG.organization_name} · read-only against GitHub and Jira
          </p>
        </div>
        <div>
          <h3 className="coverage__label">Visibility policy</h3>
          <p className="coverage__text">
            Active setting: <strong>{labels[visibility]}</strong>. Change it via Visibility in the
            top bar. In every setting a developer viewing their own profile sees their own values
            (self-view).
          </p>
        </div>
        <div className="coverage__blind">
          <h3 className="coverage__label">What the system cannot see</h3>
          <ul className="coverage__list">
            {ORG_CONFIG.blind_spots.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
