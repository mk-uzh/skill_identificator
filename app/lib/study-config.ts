// ---------------------------------------------------------------------------
// Study configuration
//
// Content-level knobs of the case study. The competences are NOT defined here
// any more — they come from model/taxonomy.json through lib/taxonomy.ts, so
// the UI and the inference cannot drift apart.
//
// The people below are demo data standing in for a public open-source project
// until the real pipeline output is wired in. Identifiers are pseudonyms by
// design: the study never shows a real name.
// ---------------------------------------------------------------------------

import { getScriptedAssessments, type EvidenceItem } from "./assessments";
import {
  CATEGORIES,
  CATEGORY_GROUPS,
  groupedCategories,
  LEVEL_ANCHORS,
  LEVEL_ANCHORS_SHORT,
} from "./taxonomy";
import type { Developer, SkillLevel } from "./types";

export const STUDY_TITLE = "DevSkill – Team Skill Matrix Study";

export { CATEGORIES, CATEGORY_GROUPS, groupedCategories, LEVEL_ANCHORS, LEVEL_ANCHORS_SHORT };

const WINDOW = "active January 2025 to October 2026";

export const DEVELOPERS: Developer[] = [
  {
    id: "DEV-01",
    label: "DEV-01",
    role: "212 changes · 41 reviews of other people's work",
    tenure: WINDOW,
    profile:
      "Works across the course tools: announcements, the calendar and the area where teachers put materials. Often picks up faults that cross several of them.",
    evidence: [
      "212 changes, the last one in October 2026",
      "Read and approved the work of 41 other people",
      "83 of the changes are linked to a task in the tracker",
      "Nothing in the part that stores data",
    ],
  },
  {
    id: "DEV-02",
    label: "DEV-02",
    role: "47 changes · 3 reviews of other people's work",
    tenure: WINDOW,
    profile:
      "Works almost only on importing and exporting course material. A narrow area, and mostly alone in it.",
    evidence: [
      "47 changes, the last one in August 2026",
      "Read the work of 3 other people",
      "Nine of their own changes were sent back for rework",
      "No work on the screens teachers see",
    ],
  },
  {
    id: "DEV-04",
    label: "DEV-04",
    role: "168 changes · 52 reviews of other people's work",
    tenure: WINDOW,
    profile:
      "Builds the part that stores things: how course material and marks are kept, and the steps that move existing data to a new shape.",
    evidence: [
      "168 changes, the last one in October 2026",
      "Wrote 22 of the 29 migration steps in the window",
      "Read and approved the work of 52 other people",
      "Rarely touches the browser part",
    ],
  },
  {
    id: "DEV-06",
    label: "DEV-06",
    role: "94 changes · 11 reviews of other people's work",
    tenure: WINDOW,
    profile:
      "Works on the screens teachers see, in particular the forms and whether they can be used with a screen reader.",
    evidence: [
      "94 changes, the last one in September 2026",
      "Carried out the accessibility review of the forms",
      "Read the work of 11 other people",
      "No work on the part that stores data",
    ],
  },
  {
    id: "DEV-07",
    label: "DEV-07",
    role: "148 changes · 37 reviews of other people's work",
    tenure: WINDOW,
    profile:
      "Works almost entirely on two parts of the platform: the tool teachers use to build quizzes, and the gradebook where marks are recorded. Both the screens and the logic behind them.",
    evidence: [
      "148 changes, the last one in October 2026",
      "Read and approved the work of 37 other people",
      "None of their own changes were sent back for rework",
      "61 of the changes are linked to a task in the tracker",
    ],
  },
  {
    id: "DEV-09",
    label: "DEV-09",
    role: "39 changes · 2 reviews of other people's work",
    tenure: WINDOW,
    profile:
      "New in the project. Small fixes spread over many areas, almost always with somebody else's review before they are accepted.",
    evidence: [
      "39 changes, the first one in March 2026",
      "Spread over nine different parts of the software",
      "14 of their own changes were sent back for rework",
      "Read the work of 2 other people",
    ],
  },
];

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
