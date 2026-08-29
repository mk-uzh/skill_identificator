import {
  FALLBACK_BASELINE,
  SCRIPTED_SUGGESTIONS,
  type ScriptedSuggestion,
} from "./study-config";
import {
  SKILL_LEVELS,
  SKILL_LEVEL_VALUE,
  type AiSuggestion,
  type Matrix,
  type SkillLevel,
} from "./types";

function shiftLevel(level: SkillLevel, delta: number): SkillLevel {
  const index = SKILL_LEVEL_VALUE[level] + delta;
  const clamped = Math.max(0, Math.min(SKILL_LEVELS.length - 1, index));
  return SKILL_LEVELS[clamped];
}

/**
 * Builds the suggestions for task 2 based on the task 1 matrix.
 *
 * The script in study-config.ts defines cell, direction and distance. The
 * concrete target value depends on the participant's input so that the
 * suggestion always deviates visibly from their own rating. Suggestions that
 * would no longer produce a deviation at the edge of the scale (e.g. "raise"
 * on an already assigned "expert") are mirrored, so every participant sees the
 * same number of suggestions.
 */
export function buildSuggestions(task1: Matrix): AiSuggestion[] {
  return SCRIPTED_SUGGESTIONS.map((script: ScriptedSuggestion) => {
    const baseline = task1[script.devId]?.[script.categoryId] ?? FALLBACK_BASELINE;

    let direction = script.direction;
    let suggested = shiftLevel(baseline, direction === "raise" ? script.delta : -script.delta);

    if (suggested === baseline) {
      direction = direction === "raise" ? "lower" : "raise";
      suggested = shiftLevel(baseline, direction === "raise" ? script.delta : -script.delta);
    }

    return {
      devId: script.devId,
      categoryId: script.categoryId,
      suggested,
      direction,
      confidence: script.confidence,
      rationale: script.rationale,
      veracity: script.veracity,
    };
  });
}

export function suggestionKey(devId: string, categoryId: string): string {
  return `${devId}::${categoryId}`;
}

export function indexSuggestions(suggestions: AiSuggestion[]): Map<string, AiSuggestion> {
  const map = new Map<string, AiSuggestion>();
  for (const s of suggestions) {
    map.set(suggestionKey(s.devId, s.categoryId), s);
  }
  return map;
}
