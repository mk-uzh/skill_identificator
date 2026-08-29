// Central type definitions of the study.

export const SKILL_LEVELS = ["none", "basic", "proficient", "expert"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  none: "none",
  basic: "basic",
  proficient: "proficient",
  expert: "expert",
};

/** Numeric value for the later analysis (distances, means). */
export const SKILL_LEVEL_VALUE: Record<SkillLevel, number> = {
  none: 0,
  basic: 1,
  proficient: 2,
  expert: 3,
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

export interface Category {
  id: string;
  label: string;
  description: string;
}

/** devId -> categoryId -> level (null = not rated yet) */
export type Matrix = Record<string, Record<string, SkillLevel | null>>;

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
  /**
   * For analysis only, NOT shown to the participant: is this suggestion
   * correct or deliberately wrong according to the study design?
   */
  veracity: "correct" | "incorrect";
}

export type SuggestionDecision = "accepted" | "dismissed" | "modified" | "open";

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

export interface SurveyAnswers {
  trustInSystem: number | null;
  confidenceTask1: number | null;
  confidenceTask2: number | null;
  perceivedUsefulness: number | null;
  comment: string;
}

export interface StudySession {
  sessionId: string;
  participantCode: string;
  condition: string;
  createdAt: string;
  userAgent: string;
  consent: boolean;
  task1?: {
    matrix: Matrix;
    submittedAt: string;
    durationMs: number;
  };
  task2?: {
    matrix: Matrix;
    submittedAt: string;
    durationMs: number;
    suggestions: AiSuggestion[];
    outcomes: SuggestionOutcome[];
  };
  survey?: SurveyAnswers;
}
