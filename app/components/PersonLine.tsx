"use client";

import { ORG_CONFIG, VISIBILITY_LABELS } from "@/lib/org-config";
import type { Developer } from "@/lib/types";

/** Who is being rated. Sits beside the work; each part opens on its own. */
export function PersonLine({ developer }: { developer: Developer }) {
  return (
    <aside className="side" aria-label={`About ${developer.label}`}>
      <div className="side__head">
        <b>{developer.label}</b>
        <p>{developer.profile}</p>
      </div>
      <details className="acc">
        <summary>Covered</summary>
        <p>
          {ORG_CONFIG.sources.map((s) => s.label).join(" and ")}, {ORG_CONFIG.observation_window.label}.{" "}
          {developer.role}.
        </p>
        <ul>
          {developer.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      <details className="acc">
        <summary>Not covered</summary>
        <p>{ORG_CONFIG.blind_spots.join(". ")}.</p>
      </details>
      <details className="acc">
        <summary>Who can see this</summary>
        <p>In this study: {VISIBILITY_LABELS[ORG_CONFIG.visibility]}, the same for everyone.</p>
      </details>
    </aside>
  );
}
