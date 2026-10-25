import type { Artifact, TaxonomyCategory, TaxonomyConfig } from "../../model/types";

export function loadTaxonomy(raw: TaxonomyConfig): TaxonomyConfig {
  return raw;
}

/** True if an artifact maps to a category via path or text patterns (concept layer). */
export function artifactMatchesCategory(
  artifact: Artifact,
  category: TaxonomyCategory,
): boolean {
  if (artifact.ai_assisted) {
    // DP11 — excluded from scoring until validated
    return false;
  }

  const pathHay = artifact.paths.join(" ").toLowerCase();
  const textHay = artifact.text_excerpt.toLowerCase();

  for (const concept of category.concepts) {
    for (const pattern of concept.path_patterns) {
      if (pathHay.includes(pattern.toLowerCase())) return true;
    }
    for (const pattern of concept.text_patterns) {
      if (textHay.includes(pattern.toLowerCase())) return true;
    }
  }
  return false;
}

export function artifactsFor(
  artifacts: Artifact[],
  developerId: string,
  category: TaxonomyCategory,
): Artifact[] {
  return artifacts
    .filter((a) => a.developer_id === developerId && artifactMatchesCategory(a, category))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
}
