/**
 * Signal extraction (Spec §5 priority order).
 * Volume counts may be used internally as ratios only — never as ability labels.
 * Lead time is never used.
 */

import type { Artifact, TaxonomyCategory } from "../../model/types";
import { artifactsFor } from "./map";

export interface ExtractedSignals {
  /** 0..1 ownership / concentration in this category's paths. */
  ownership: number;
  /** 0..1 quality proxies (reviews, test-touching work). */
  quality: number;
  /** 0..1 semantic match strength. */
  semantic: number;
  /** Supporting artifacts for evidence assembly (sorted, capped later). */
  support: Artifact[];
  kindsPresent: Set<string>;
}

function isTestTouching(artifact: Artifact): boolean {
  const blob = `${artifact.paths.join(" ")} ${artifact.text_excerpt}`.toLowerCase();
  return (
    blob.includes("test") ||
    blob.includes("e2e") ||
    blob.includes("spec") ||
    artifact.paths.some((p) => p.includes("tests/") || p.includes("__tests__"))
  );
}

/**
 * Ownership: fraction of this developer's mapped artifacts in this category
 * among all of their mapped artifacts across categories — concentration signal.
 * Uses shares, not raw counts, in the returned score.
 */
export function extractSignals(
  allArtifacts: Artifact[],
  developerId: string,
  category: TaxonomyCategory,
  allCategories: TaxonomyCategory[],
): ExtractedSignals {
  const support = artifactsFor(allArtifacts, developerId, category);
  const kindsPresent = new Set(support.map((a) => a.kind));

  let totalMapped = 0;
  for (const cat of allCategories) {
    totalMapped += artifactsFor(allArtifacts, developerId, cat).length;
  }

  // Share of the developer's observable work that lands in this category (ratio).
  const ownership =
    totalMapped === 0 ? 0 : Math.min(1, support.length / Math.max(1, totalMapped));

  // Boost when work is concentrated in category-owned path prefixes.
  const pathHit = support.filter((a) => a.paths.length > 0).length;
  const ownershipScore =
    support.length === 0
      ? 0
      : 0.55 * ownership + 0.45 * (pathHit / support.length);

  const reviewShare =
    support.length === 0
      ? 0
      : support.filter((a) => a.kind === "review").length / support.length;
  const testShare =
    support.length === 0 ? 0 : support.filter(isTestTouching).length / support.length;
  const quality = Math.min(1, 0.6 * reviewShare + 0.4 * testShare + (kindsPresent.has("review") ? 0.15 : 0));

  // Semantic: already filtered by patterns; diversity of matching kinds strengthens the signal.
  const semantic =
    support.length === 0
      ? 0
      : Math.min(1, 0.35 + 0.2 * kindsPresent.size + (support.some((a) => a.source === "jira") ? 0.1 : 0));

  return {
    ownership: clamp01(ownershipScore),
    quality: clamp01(quality),
    semantic: clamp01(semantic),
    support,
    kindsPresent,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
