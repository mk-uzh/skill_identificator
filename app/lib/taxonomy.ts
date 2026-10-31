// ---------------------------------------------------------------------------
// Taxonomy (DP9)
//
// model/taxonomy.json is the single source of truth for the competences and
// the level anchors. The UI used to carry a second, hand-maintained copy of
// the category list; the two drifted apart. Everything now reads from here.
// ---------------------------------------------------------------------------

import rawTaxonomy from "../../model/taxonomy.json";
import type { Category, CategoryGroup, SkillLevel } from "./types";
import { SKILL_LEVELS } from "./types";

interface RawCategory {
  key: string;
  group: string;
  label: string;
  plain: string;
  description?: string;
  definition?: string;
  order: number;
}

interface RawTaxonomy {
  taxonomy_version: string;
  esco_version: string;
  uri_status: string;
  level_scale: {
    anchors: Record<string, string>;
    anchors_short: Record<string, string>;
    source: string;
  };
  groups: Array<{ key: string; label: string; order: number }>;
  categories: RawCategory[];
}

const taxonomy = rawTaxonomy as unknown as RawTaxonomy;

export const TAXONOMY_VERSION = taxonomy.taxonomy_version;
export const ESCO_VERSION = taxonomy.esco_version;
/** Reminder that the concept URIs are placeholders, surfaced in the export. */
export const URI_STATUS = taxonomy.uri_status;
export const LEVEL_SCALE_SOURCE = taxonomy.level_scale.source;

export const CATEGORY_GROUPS: CategoryGroup[] = [...taxonomy.groups]
  .sort((a, b) => a.order - b.order)
  .map((g) => ({ id: g.key, label: g.label, order: g.order }));

export const CATEGORIES: Category[] = [...taxonomy.categories]
  .sort((a, b) => a.order - b.order)
  .map((c) => ({
    id: c.key,
    label: c.label,
    plain: c.plain,
    description: c.description ?? c.definition ?? c.plain,
    groupId: c.group,
    order: c.order,
  }));

export const LEVEL_ANCHORS: Record<SkillLevel, string> = (() => {
  const anchors = taxonomy.level_scale.anchors;
  const missing = SKILL_LEVELS.filter((level) => !anchors[level]);
  if (missing.length > 0) {
    throw new Error(
      `[taxonomy.json] level_scale.anchors is missing: ${missing.join(", ")}`,
    );
  }
  return Object.fromEntries(
    SKILL_LEVELS.map((level) => [level, anchors[level]]),
  ) as Record<SkillLevel, string>;
})();

/** One-line form for the guide that sits beside the rating, as in the draft. */
export const LEVEL_ANCHORS_SHORT: Record<SkillLevel, string> = (() => {
  const short = taxonomy.level_scale.anchors_short ?? {};
  return Object.fromEntries(
    SKILL_LEVELS.map((level) => [level, short[level] ?? LEVEL_ANCHORS[level]]),
  ) as Record<SkillLevel, string>;
})();

const groupIds = new Set(CATEGORY_GROUPS.map((g) => g.id));
for (const category of CATEGORIES) {
  if (!groupIds.has(category.groupId)) {
    throw new Error(
      `[taxonomy.json] category "${category.id}" points at unknown group "${category.groupId}"`,
    );
  }
}

/** Competences of one group, in display order. */
export function categoriesOfGroup(groupId: string): Category[] {
  return CATEGORIES.filter((c) => c.groupId === groupId);
}

/** Groups with their competences, ready to render as a grouped list. */
export function groupedCategories(): Array<{ group: CategoryGroup; items: Category[] }> {
  return CATEGORY_GROUPS.map((group) => ({
    group,
    items: categoriesOfGroup(group.id),
  })).filter((entry) => entry.items.length > 0);
}
