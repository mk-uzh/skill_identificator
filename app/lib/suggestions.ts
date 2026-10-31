import { getAssessments } from "./assessments";
import { DEFAULT_PROJECT, type ProjectId } from "./project";
import { emptyMatrix } from "./matrix";
import { signalsFromEvidence } from "./org-config";
import type { AiSuggestion, Matrix, SkillLevel } from "./types";

/**
 * Builds Task-2 suggestions from data/assessments.json (absolute levels).
 * One suggestion per developer × display category.
 */
export function buildSuggestionsFromAssessments(project: ProjectId = DEFAULT_PROJECT): AiSuggestion[] {
  return getAssessments(project).assessments.map((assessment) => ({
    devId: assessment.developer_id,
    categoryId: assessment.category_id,
    suggested: assessment.level,
    direction: assessment.study?.direction ?? "raise",
    confidence: assessment.confidence,
    rationale: assessment.rationale,
    levelReason: assessment.level_reason,
    evidence: assessment.evidence,
    signals: signalsFromEvidence(assessment.evidence),
    veracity: assessment.study?.veracity ?? "correct",
  }));
}

/** Prefill matrix for Task 2 — every cell set to the inferred level from the file. */
export function assessmentsToMatrix(project: ProjectId = DEFAULT_PROJECT): Matrix {
  const matrix = emptyMatrix();
  for (const assessment of getAssessments(project).assessments) {
    if (!matrix[assessment.developer_id]) {
      matrix[assessment.developer_id] = {};
    }
    matrix[assessment.developer_id][assessment.category_id] = assessment.level as SkillLevel;
  }
  return matrix;
}

/** @deprecated Prefer buildSuggestionsFromAssessments — kept for call-site clarity. */
export function buildSuggestions(_task1: Matrix): AiSuggestion[] {
  return buildSuggestionsFromAssessments();
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
