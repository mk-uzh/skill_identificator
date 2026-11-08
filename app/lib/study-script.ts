// ---------------------------------------------------------------------------
// Study script (Task 2)
//
// study-data/study-script*.json says which proposals are deliberately off by
// one level, in two versions (A and B). The cells of A and B are disjoint, so
// every cell is shown correctly in one version and wrongly in the other.
// The version follows from the participant code (stable, no randomness at
// run time), so it can be reconstructed during analysis.
//
// Written by llm-pipeline/study_script.py. An empty script means no
// manipulation: every proposal is the level the records support.
// ---------------------------------------------------------------------------

import rawSakai from "../../study-data/study-script.json";
import rawNifi from "../../study-data/study-script.nifi.json";
import { hashCode } from "./study-flow";
import { DEFAULT_PROJECT, type ProjectId } from "./project";
import { SKILL_LEVELS, type SkillLevel } from "./types";

export type StudyVersion = "A" | "B";

export interface WrongCell {
  developer_id: string;
  category_id: string;
  true_level: SkillLevel;
  shown_level: SkillLevel;
  direction: "raise" | "lower";
  level_reason: string;
}

export interface StudyScript {
  project: string;
  seed: number;
  versions: Record<StudyVersion, WrongCell[]>;
}

export class StudyScriptSchemaError extends Error {
  constructor(message: string) {
    super(`[study-script] ${message}`);
    this.name = "StudyScriptSchemaError";
  }
}

function validate(raw: unknown, label: string): StudyScript {
  const file = raw as Partial<StudyScript> | null;
  if (!file || typeof file !== "object" || !file.versions) {
    throw new StudyScriptSchemaError(`${label}: versions missing`);
  }
  const seen = new Set<string>();
  for (const v of ["A", "B"] as const) {
    const list = file.versions[v];
    if (!Array.isArray(list)) throw new StudyScriptSchemaError(`${label}.versions.${v} must be an array`);
    list.forEach((w, i) => {
      const where = `${label}.versions.${v}[${i}]`;
      if (typeof w.developer_id !== "string" || typeof w.category_id !== "string") {
        throw new StudyScriptSchemaError(`${where} needs developer_id and category_id`);
      }
      if (!SKILL_LEVELS.includes(w.true_level) || !SKILL_LEVELS.includes(w.shown_level)) {
        throw new StudyScriptSchemaError(`${where} has an invalid level`);
      }
      if (w.true_level === w.shown_level) {
        throw new StudyScriptSchemaError(`${where} shows the true level`);
      }
      if (typeof w.level_reason !== "string" || !w.level_reason.trim()) {
        throw new StudyScriptSchemaError(`${where}.level_reason must be a non-empty string`);
      }
      const key = `${w.developer_id}::${w.category_id}`;
      if (v === "A") seen.add(key);
      else if (seen.has(key)) throw new StudyScriptSchemaError(`${where} is wrong in both versions`);
    });
  }
  return file as StudyScript;
}

const SCRIPTS: Record<ProjectId, StudyScript> = {
  sakai: validate(rawSakai, "study-script.json"),
  nifi: validate(rawNifi, "study-script.nifi.json"),
};

/** Same code, same version, every time. */
export function versionFor(participantCode: string): StudyVersion {
  return hashCode(`version:${participantCode || "default"}`) % 2 === 0 ? "A" : "B";
}

/** The deliberately wrong cells for this participant, keyed by "dev::category". */
export function wrongCellsFor(
  participantCode: string | undefined,
  project: ProjectId = DEFAULT_PROJECT,
): Map<string, WrongCell> {
  const map = new Map<string, WrongCell>();
  if (!participantCode) return map;
  for (const w of SCRIPTS[project].versions[versionFor(participantCode)]) {
    map.set(`${w.developer_id}::${w.category_id}`, w);
  }
  return map;
}
