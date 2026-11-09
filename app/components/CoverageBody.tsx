"use client";

import { ORG_CONFIG } from "@/lib/org-config";
import type { Developer } from "@/lib/types";

/** What the records cover and what they do not, for one person. Shown inside an InfoTip. */
export function CoverageBody({ developer }: { developer: Developer }) {
  return (
    <span className="tipbody">
      <b>Covered</b>
      <span className="tipbody__p">
        {ORG_CONFIG.sources.map((s) => `${s.label}: ${s.detail}`).join(". ")}.{" "}
        {ORG_CONFIG.observation_window.label}.
      </span>
      <span className="tipbody__p">
        {developer.role}. {developer.evidence.join(". ")}.
      </span>
      <b>Not covered</b>
      <span className="tipbody__p">{ORG_CONFIG.blind_spots.join(". ")}.</span>
    </span>
  );
}
