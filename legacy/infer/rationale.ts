import type { TaxonomyCategory } from "../../model/types";
import type { ScoredAssessment } from "./score";
import type { ExtractedSignals } from "./signals";

/**
 * One-sentence plain-language rationale.
 * Must never mention commit counts, LOC, ticket counts, or lead time.
 */
export function generateRationale(
  category: TaxonomyCategory,
  scored: ScoredAssessment,
  signals: ExtractedSignals,
): string {
  const label = category.label;

  if (scored.level === "none" && scored.evidence.length === 0) {
    return `No observable contribution in ${label} within the observation window.`;
  }

  if (scored.thinEvidence && scored.level === "none") {
    return `Evidence in ${label} is too thin to support a higher level.`;
  }

  const kinds = Array.from(signals.kindsPresent).sort();
  const kindPhrase =
    kinds.length === 0
      ? "limited artifacts"
      : kinds.length === 1
        ? `${kinds[0].replace("_", " ")} activity`
        : `${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1].replace("_", " ")} activity`;

  if (scored.level === "expert") {
    return `Sets direction in ${label} through concentrated ${kindPhrase} across core components.`;
  }
  if (scored.level === "proficient") {
    return `Works independently in ${label}, supported by ${kindPhrase} aligned to this discipline.`;
  }
  if (scored.level === "basic") {
    return `Has worked in ${label} under guidance, with ${kindPhrase} in the observation window.`;
  }

  return `Little sustained ${label} ownership beyond occasional ${kindPhrase}.`;
}
