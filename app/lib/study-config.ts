// ---------------------------------------------------------------------------
// Study configuration
//
// Content-level knobs of the case study. The competences are NOT defined here
// any more — they come from model/taxonomy.json through lib/taxonomy.ts, so
// the UI and the inference cannot drift apart.
//
// People are loaded from study-data/people*.json (real counts from the silver
// tables). Identifiers are pseudonyms by design: the study never shows a real name.
// ---------------------------------------------------------------------------

import rawPeopleSakai from "../../study-data/people.json";
import rawPeopleNifi from "../../study-data/people.nifi.json";
import { getScriptedAssessments, type EvidenceItem } from "./assessments";
import {
  CATEGORIES,
  CATEGORY_GROUPS,
  groupedCategories,
  LEVEL_ANCHORS,
  LEVEL_ANCHORS_SHORT,
} from "./taxonomy";
import { DEFAULT_PROJECT, type ProjectId } from "./project";
import type { Developer, SkillLevel } from "./types";

export const STUDY_TITLE = "DevSkill – Team Skill Matrix Study";

export { CATEGORIES, CATEGORY_GROUPS, groupedCategories, LEVEL_ANCHORS, LEVEL_ANCHORS_SHORT };

// People come from study-data/people*.json, written by llm-pipeline/people.py
// from the silver tables. Nothing about a person is typed in by hand.
function loadPeople(raw: unknown, label: string): Developer[] {
  const file = raw as { people?: unknown };
  if (!Array.isArray(file?.people) || file.people.length === 0) {
    throw new Error(`[study-config] ${label}.people must be a non-empty array`);
  }
  return file.people.map((p: Record<string, unknown>, i: number) => {
    for (const key of ["id", "label", "role", "tenure", "profile"]) {
      if (typeof p[key] !== "string" || !(p[key] as string).trim()) {
        throw new Error(`[study-config] ${label}.people[${i}].${key} must be a non-empty string`);
      }
    }
    if (!Array.isArray(p.evidence) || !p.evidence.every((e) => typeof e === "string")) {
      throw new Error(`[study-config] ${label}.people[${i}].evidence must be an array of strings`);
    }
    return p as unknown as Developer;
  });
}

const SAKAI_DEVELOPERS: Developer[] = loadPeople(rawPeopleSakai, "people.json");
const NIFI_DEVELOPERS: Developer[] = loadPeople(rawPeopleNifi, "people.nifi.json");

const DEVELOPERS_BY_PROJECT: Record<ProjectId, Developer[]> = {
  sakai: SAKAI_DEVELOPERS,
  nifi: NIFI_DEVELOPERS,
};

/** The people shown for one project. Ids are the same in every project. */
export function getDevelopers(project: ProjectId = DEFAULT_PROJECT): Developer[] {
  return DEVELOPERS_BY_PROJECT[project];
}

/** Default project. Use getDevelopers / useProject where names or texts are shown. */
export const DEVELOPERS: Developer[] = SAKAI_DEVELOPERS;

// ---------------------------------------------------------------------------
// AI suggestions
//
// The controllable study script lives in study-data/assessments.json
// (fields study.*, plus confidence / rationale / evidence). Loaded and
// schema-validated on module load — malformed files fail loudly.
// ---------------------------------------------------------------------------

export interface ScriptedSuggestion {
  devId: string;
  categoryId: string;
  direction: "raise" | "lower";
  /** By how many levels the suggestion deviates from the input. */
  delta: number;
  confidence: number;
  rationale: string;
  evidence: EvidenceItem[];
  /** Absolute inferred level from the assessments contract (M1). */
  level: SkillLevel;
  veracity: "correct" | "incorrect";
}

function loadScriptedSuggestions(): ScriptedSuggestion[] {
  return getScriptedAssessments().map((assessment) => {
    const study = assessment.study;
    if (!study) {
      throw new Error(
        `[study-config] assessment ${assessment.id} is missing study metadata`,
      );
    }
    return {
      devId: assessment.developer_id,
      categoryId: assessment.category_id,
      direction: study.direction,
      delta: study.delta,
      confidence: assessment.confidence,
      rationale: assessment.rationale,
      evidence: assessment.evidence,
      level: assessment.level,
      veracity: study.veracity,
    };
  });
}

/** Lazily validated against study-data/assessments.json. */
export const SCRIPTED_SUGGESTIONS: ScriptedSuggestion[] = loadScriptedSuggestions();

/**
 * If a cell is left empty in the own assessment, this is the starting point
 * for computing the suggestion.
 */
export const FALLBACK_BASELINE: SkillLevel = "l2";

/** Controls whether confidence values and rationales are shown. */
export const SHOW_CONFIDENCE = true;
export const SHOW_RATIONALE = true;
