/**
 * Scoring rules (Spec §5) — binding:
 * - never surface volume counts as ability
 * - never derive effort from lead time
 * - every assessment carries confidence + evidence
 */

import type { Artifact } from "../model/types";
import type { ExtractedSignals } from "./signals";

export type SkillLevel = "none" | "basic" | "proficient" | "expert";

export interface ScoredAssessment {
  level: SkillLevel;
  confidence: number;
  evidence: Artifact[];
  composite: number;
  thinEvidence: boolean;
}

/**
 * Weighted composite of ownership > quality > semantic.
 * Thresholds map to anchored levels. Thin evidence → level none with calibrated confidence.
 */
export function scoreSignals(signals: ExtractedSignals): ScoredAssessment {
  const composite = clamp01(
    0.5 * signals.ownership + 0.3 * signals.quality + 0.2 * signals.semantic,
  );

  const evidence = pickEvidence(signals.support);
  const thinEvidence = evidence.length === 0 || (evidence.length === 1 && composite < 0.25);

  let level: SkillLevel;
  if (thinEvidence && composite < 0.2) {
    // Spec: where evidence is too thin, do not invent a positive level.
    level = "none";
  } else if (composite < 0.18) {
    level = "none";
  } else if (composite < 0.4) {
    level = "basic";
  } else if (composite < 0.65) {
    level = "proficient";
  } else {
    level = "expert";
  }

  const confidence = computeConfidence(signals, evidence, level, thinEvidence);

  return { level, confidence, evidence, composite, thinEvidence };
}

/**
 * Confidence from agreement / diversity / recency — not from commit volume.
 */
function computeConfidence(
  signals: ExtractedSignals,
  evidence: Artifact[],
  level: SkillLevel,
  thinEvidence: boolean,
): number {
  if (evidence.length === 0) {
    // Fairly confident in "none" when nothing maps — absence is observable.
    return 0.72;
  }

  const kindDiversity = Math.min(1, signals.kindsPresent.size / 3);
  const signalAgreement = 1 - stddev([signals.ownership, signals.quality, signals.semantic]);
  const recency = recencyScore(evidence);

  let confidence = 0.35 + 0.25 * kindDiversity + 0.25 * signalAgreement + 0.15 * recency;

  if (thinEvidence && level !== "none") {
    confidence *= 0.55;
  }
  if (level === "none" && evidence.length <= 1) {
    confidence = Math.max(confidence, 0.7);
  }

  // Round for stable JSON (determinism).
  return round2(clamp01(confidence));
}

function pickEvidence(support: Artifact[]): Artifact[] {
  // Prefer reviews and PRs over sheer commit lists; cap at 3; never expose counts in titles.
  const rank = (a: Artifact): number => {
    if (a.kind === "review") return 3;
    if (a.kind === "pull_request") return 2;
    if (a.kind === "issue") return 1;
    return 0;
  };
  return [...support]
    .sort(
      (a, b) =>
        rank(b) - rank(a) || b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id),
    )
    .slice(0, 3);
}

function recencyScore(evidence: Artifact[]): number {
  if (evidence.length === 0) return 0;
  const latest = evidence.map((e) => Date.parse(e.timestamp)).sort((a, b) => b - a)[0];
  const ageDays = (Date.parse("2025-12-01T10:00:00.000Z") - latest) / (86400 * 1000);
  if (ageDays <= 30) return 1;
  if (ageDays <= 90) return 0.75;
  if (ageDays <= 180) return 0.5;
  return 0.3;
}

function stddev(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
