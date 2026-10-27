// ---------------------------------------------------------------------------
// Organization-level UI config (visibility, coverage, anchors, banner).
// Loaded from config — not hardcoded into components.
// ---------------------------------------------------------------------------

import { LEVEL_ANCHORS } from "./taxonomy";

export type VisibilityMode = "lead_only" | "team_visible" | "self_only_plus_lead";

export const VISIBILITY_LABELS: Record<VisibilityMode, string> = {
  lead_only: "Lead only",
  team_visible: "Team visible",
  self_only_plus_lead: "Self + lead",
};

export const ORG_CONFIG = {
  organization_id: "demo-project",
  organization_name: "Demo project (public open-source repository)",
  /** DP6 — declared visibility regime. Default lead_only. */
  visibility: "lead_only" as VisibilityMode,
  observation_window: {
    start: "2025-01-01",
    end: "2026-10-01",
    label: "1 Jan 2025 – 1 Oct 2026",
  },
  sources: [
    { id: "github", label: "GitHub", detail: "commits, pull requests, reviews" },
    { id: "jira", label: "Jira", detail: "issues and ticket metadata" },
  ],
  /** DP7 — what the system cannot see. */
  blind_spots: [
    "Collaboration style, mentoring quality and communication",
    "Review and mentoring work that leaves no trace in GitHub or Jira",
    "Work outside the tracked repositories and issue projects",
    "Effort or hours worked — lead time is never treated as ability",
  ],
  /** DP5 / DP3 — permanent banner copy. */
  banner:
    "This profile is not used for performance review, remuneration or promotion. The decision rests with the person using it.",
  /** DP2 — level anchors, taken from the taxonomy so there is one wording. */
  level_anchors: LEVEL_ANCHORS,
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
