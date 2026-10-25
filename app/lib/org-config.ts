// ---------------------------------------------------------------------------
// Organization-level UI config (visibility, coverage, anchors, banner).
// Loaded from config — not hardcoded into components.
// ---------------------------------------------------------------------------

import type { SkillLevel } from "./types";

export type VisibilityMode = "lead_only" | "team_visible" | "self_only_plus_lead";

export const VISIBILITY_LABELS: Record<VisibilityMode, string> = {
  lead_only: "Lead only",
  team_visible: "Team visible",
  self_only_plus_lead: "Self + lead",
};

export const ORG_CONFIG = {
  organization_id: "demo-org",
  organization_name: "Demo Organization",
  /** DP6 — declared visibility regime. Default lead_only. */
  visibility: "lead_only" as VisibilityMode,
  observation_window: {
    start: "2025-01-01",
    end: "2025-12-01",
    label: "1 Jan 2025 – 1 Dec 2025",
  },
  sources: [
    { id: "github", label: "GitHub", detail: "commits, pull requests, reviews" },
    { id: "jira", label: "Jira", detail: "issues and ticket metadata" },
  ],
  /** DP7 — what the system cannot see. */
  blind_spots: [
    "Soft skills (collaboration style, mentoring quality, communication)",
    "Review and mentoring work that leaves no trace in GitHub or Jira",
    "Work outside the tracked repositories and issue projects",
    "Effort or hours worked — lead time is never treated as ability",
  ],
  /** DP5 / DP3 — permanent banner copy. */
  banner:
    "This profile is not used for performance review, remuneration or promotion. The decision rests with the person using it.",
  /** DP2 — level anchors shown on hover / in the legend. */
  level_anchors: {
    none: "no observable contribution in this area",
    basic: "has worked in this area, under guidance",
    proficient: "works independently in this area",
    expert: "sets direction in this area and enables others",
  } satisfies Record<SkillLevel, string>,
};

export interface DisplaySignal {
  kind: string;
  label: string;
}

/** Derive readable signals from evidence kinds when the file has no explicit signals. */
export function signalsFromEvidence(
  evidence: Array<{ kind: string }>,
): DisplaySignal[] {
  const kinds = new Set(evidence.map((e) => e.kind));
  const signals: DisplaySignal[] = [];
  if (kinds.has("commit") || kinds.has("pull_request")) {
    signals.push({
      kind: "ownership",
      label: "Ownership / concentration of work in related paths",
    });
  }
  if (kinds.has("review")) {
    signals.push({
      kind: "quality_proxy",
      label: "Review activity as a quality proxy",
    });
  }
  if (kinds.has("issue")) {
    signals.push({
      kind: "semantic_match",
      label: "Issue / ticket alignment with the category",
    });
  }
  if (signals.length === 0) {
    signals.push({
      kind: "thin_evidence",
      label: "Limited observable artifacts in the observation window",
    });
  }
  return signals;
}
