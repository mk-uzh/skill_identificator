// Central type definitions of the study.

/**
 * Level scale (DP2).
 *
 * Five ordered levels from the European e-Competence Framework (EN 16234-1),
 * plus "not observable", which is deliberately NOT a sixth level: it says the
 * records hold nothing about this competence for this person. Keeping it apart
 * from l1 matters for the analysis — a blind spot is information, not a low
 * score, and averaging the two together would hide exactly what DP7 asks the
 * system to declare.
 */
export const ORDERED_LEVELS = ["l1", "l2", "l3", "l4", "l5"] as const;
export const SKILL_LEVELS = [...ORDERED_LEVELS, "not_observable"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export type OrderedLevel = (typeof ORDERED_LEVELS)[number];

export function isOrderedLevel(level: SkillLevel | null): level is OrderedLevel {
  return level != null && level !== "not_observable";
}

/** Short form for the level buttons. */
export const SKILL_LEVEL_SHORT: Record<SkillLevel, string> = {
  l1: "1",
  l2: "2",
  l3: "3",
  l4: "4",
  l5: "5",
  not_observable: "n/o",
};

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  l1: "Follows a given approach",
  l2: "Completes routine tasks alone",
  l3: "Solves and explains the cause",
  l4: "Others rely on it",
  l5: "Sets the approach for others",
  not_observable: "Not observable",
};

/**
 * Numeric value for the analysis. null for "not observable" on purpose: there
 * is no number that is honest there, and a 0 would be averaged as if it were
 * the bottom of the scale.
 */
export const SKILL_LEVEL_VALUE: Record<SkillLevel, number | null> = {
  l1: 1,
  l2: 2,
  l3: 3,
  l4: 4,
  l5: 5,
  not_observable: null,
};

export interface Developer {
  id: string;
  /** Display name in the matrix, e.g. "Dev A" */
  label: string;
  role: string;
  tenure: string;
  /** Short profile that participants see as the basis for their judgement. */
  profile: string;
  /** Keywords from commits / tickets / projects. */
  evidence: string[];
}

/** A competence group, e.g. "Testing and quality assurance". */
export interface CategoryGroup {
  id: string;
  label: string;
  order: number;
}

/** One competence. `label` is the ESCO term, `plain` is what it means. */
export interface Category {
  id: string;
  label: string;
  plain: string;
  description: string;
  groupId: string;
  order: number;
}

/** devId -> categoryId -> level (null = not rated yet) */
export type Matrix = Record<string, Record<string, SkillLevel | null>>;

export interface SuggestionEvidence {
  kind: "commit" | "pull_request" | "review" | "issue";
  title: string;
  timestamp: string;
  url: string;
}

export interface SuggestionSignal {
  kind: string;
  label: string;
}

export interface AiSuggestion {
  devId: string;
  categoryId: string;
  /** The value proposed by the system. */
  suggested: SkillLevel;
  /** Direction relative to the participant's task 1 rating. */
  direction: "raise" | "lower";
  /** 0..1, displayed as a percentage. */
  confidence: number;
  /** Short rationale shown by the system. */
  rationale: string;
  /** Why the system proposes this level (Task 2). */
  levelReason?: string;
  /** Concrete artifacts behind the suggestion (M1 contract). */
  evidence: SuggestionEvidence[];
  /** Signals that contributed to the assessment (shown in evidence popover). */
  signals: SuggestionSignal[];
  /**
   * For analysis only, NOT shown to the participant: is this suggestion
   * correct or deliberately wrong according to the study design?
   */
  veracity: "correct" | "incorrect";
}

/** UI state for a Task-2 cell decision (maps to §6 interaction_type on submit). */
export type SuggestionDecision =
  | "accepted_unchanged"
  | "adjusted"
  | "rejected"
  | "open";

export interface SuggestionOutcome {
  devId: string;
  categoryId: string;
  suggested: SkillLevel;
  veracity: "correct" | "incorrect";
  initialValue: SkillLevel | null;
  finalValue: SkillLevel | null;
  decision: SuggestionDecision;
  /** ms from first display until the decision */
  timeToDecisionMs: number | null;
  /** How often the participant changed this cell */
  changeCount: number;
}

export type EventType =
  | "session_start"
  | "consent_given"
  | "task_start"
  | "cell_open"
  | "cell_change"
  | "suggestion_shown"
  | "suggestion_accept"
  | "suggestion_dismiss"
  | "suggestion_modify"
  | "evidence_open"
  | "evidence_close"
  | "rationale_open"
  | "rationale_close"
  | "profile_open"
  | "profile_close"
  | "window_blur"
  | "window_focus"
  | "task_submit"
  | "survey_submit";

export interface StudyEvent {
  /** Client timestamp (ISO) */
  ts: string;
  /** ms since the start of the respective task */
  tMs: number;
  sessionId: string;
  task: 1 | 2 | 0;
  type: EventType;
  devId?: string;
  categoryId?: string;
  from?: SkillLevel | null;
  to?: SkillLevel | null;
  suggested?: SkillLevel;
  meta?: Record<string, unknown>;
}

export type VisibilityPreference =
  | "lead_only"
  | "team_visible"
  | "self_only_plus_lead"
  | null;

export interface SurveyAnswers {
  trustInSystem: number | null;
  confidenceTask1: number | null;
  confidenceTask2: number | null;
  perceivedUsefulness: number | null;
  /** Which visibility regime the participant would choose in their org (DP6). */
  visibilityPreference: VisibilityPreference;
  /** Free-text rationale for the visibility choice. */
  visibilityReason: string;
  comment: string;
}

export interface StudySession {
  sessionId: string;
  /** Pseudonymous participant id (participant code). */
  participantCode: string;
  condition: string;
  createdAt: string;
  userAgent: string;
  consent: boolean;
  /** Project the case study was run on (sakai or nifi). */
  project?: string;
  /** Taxonomy / inference config hash from assessments.json */
  config_hash?: string;
  /** Snapshot hash (demo: same as assessments config until real ingest). */
  snapshot_hash?: string;
  /**
   * Order in which this participant works through the developers. The study
   * is blocked per person, so this is also the block order: index 0 is the
   * first block. Derived from the participant code, stored for the analysis.
   */
  devOrder?: string[];
  /**
   * Set when the run was cut short from the prototype shortcut. Such a
   * session is NOT a participant run: most cells were never seen, and the
   * analysis has to exclude it.
   */
  prototype_skip?: boolean;
  task1?: {
    matrix: Matrix;
    startedAt: string;
    submittedAt: string;
    durationMs: number;
  };
  task2?: {
    matrix: Matrix;
    startedAt: string;
    submittedAt: string;
    durationMs: number;
    suggestions: AiSuggestion[];
    outcomes: SuggestionOutcome[];
  };
  survey?: SurveyAnswers;
}
