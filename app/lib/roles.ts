// ---------------------------------------------------------------------------
// Role fit (ESCO occupation layer)
//
// ESCO lists, for every occupation, the competences it considers essential.
// This module compares a finished assessment against those lists.
//
// Two honesty constraints are built in:
//  - only the essential competences that THIS taxonomy measures are counted,
//    and the ones it does not measure are named, so a high match can never be
//    read as "fits the role";
//  - a competence counts as demonstrated from level 2 up. Level 1 means the
//    person follows an approach set by someone else, and
//    "not observable" says the records are silent — neither is evidence of
//    being able to carry the work.
// ---------------------------------------------------------------------------

import rawRoles from "../../model/roles.json";
import { CATEGORIES } from "./taxonomy";
import { SKILL_LEVEL_VALUE, type Matrix, type SkillLevel } from "./types";

export interface Role {
  key: string;
  label: string;
  essential_measured: string[];
  essential_not_measured: string[];
}

interface RawRoles {
  roles_version: string;
  uri_status: string;
  roles: Role[];
}

const file = rawRoles as unknown as RawRoles;

export const ROLES_VERSION = file.roles_version;
export const ROLES_URI_STATUS = file.uri_status;
export const ROLES: Role[] = file.roles;

const known = new Set(CATEGORIES.map((c) => c.id));
for (const role of ROLES) {
  for (const id of role.essential_measured) {
    if (!known.has(id)) {
      throw new Error(`[roles.json] "${role.key}" references unknown competence "${id}"`);
    }
  }
}

/** Level 2 and up counts as demonstrated. */
export function isDemonstrated(level: SkillLevel | null | undefined): boolean {
  if (!level) return false;
  const value = SKILL_LEVEL_VALUE[level];
  return value != null && value >= 2;
}

export interface RoleFit {
  role: Role;
  demonstrated: number;
  measured: number;
  /** Essential competences this taxonomy measures but the records do not show. */
  missing: string[];
  share: number;
}

export function roleFits(matrix: Matrix, devId: string): RoleFit[] {
  const row = matrix[devId] ?? {};
  return ROLES.map((role) => {
    const missing = role.essential_measured.filter((id) => !isDemonstrated(row[id]));
    const demonstrated = role.essential_measured.length - missing.length;
    return {
      role,
      demonstrated,
      measured: role.essential_measured.length,
      missing,
      share: role.essential_measured.length === 0 ? 0 : demonstrated / role.essential_measured.length,
    };
  }).sort((a, b) => b.share - a.share || b.demonstrated - a.demonstrated);
}

export function labelOf(categoryId: string): string {
  return CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}

/** What the final assessment suggests about future work, read off the levels. */
export function futureWork(matrix: Matrix, devId: string): {
  ready: string[];
  grow: string[];
  conversation: string[];
} {
  const row = matrix[devId] ?? {};
  const ready: string[] = [];
  const grow: string[] = [];
  const conversation: string[] = [];
  for (const category of CATEGORIES) {
    const level = row[category.id] ?? null;
    if (level === "not_observable" || level == null) {
      conversation.push(category.label);
      continue;
    }
    const value = SKILL_LEVEL_VALUE[level] ?? 0;
    if (value >= 4) ready.push(category.label);
    else if (value === 3) grow.push(category.label);
  }
  return { ready, grow, conversation };
}
