// ---------------------------------------------------------------------------
// Section 6 interaction-log contract
//
// Field names are fixed for the thesis analysis. Do not rename.
// ---------------------------------------------------------------------------

import type { Matrix, SkillLevel } from "./types";

/** Spec §6 interaction_type enum — exact spellings. */
export type InteractionType =
  | "accepted_unchanged"
  | "adjusted"
  | "rejected"
  | "set_manually";

/** One row per cell interaction (section 6). */
export interface CellInteractionRow {
  session_id: string;
  participant_id: string;
  task: 1 | 2;
  developer_id: string;
  category_id: string;
  suggested_level: SkillLevel | null;
  suggested_confidence: number | null;
  task1_value: SkillLevel | null;
  final_value: SkillLevel | null;
  interaction_type: InteractionType;
  evidence_opened: boolean;
  evidence_open_ms: number;
  opened_at: string;
  committed_at: string;
  change_count: number;
  /** DP4 — free-text objection; empty string when none. Stored with the log. */
  correction_note: string;
}

export const INTERACTION_CSV_HEADERS: (keyof CellInteractionRow)[] = [
  "session_id",
  "participant_id",
  "task",
  "developer_id",
  "category_id",
  "suggested_level",
  "suggested_confidence",
  "task1_value",
  "final_value",
  "interaction_type",
  "evidence_opened",
  "evidence_open_ms",
  "opened_at",
  "committed_at",
  "change_count",
  "correction_note",
];

export function cellKey(developerId: string, categoryId: string): string {
  return `${developerId}::${categoryId}`;
}

export function nowIsoMs(): string {
  return new Date().toISOString();
}

/** Derive Task-2 interaction_type from final value vs suggestion. */
export function resolveTask2InteractionType(
  finalValue: SkillLevel | null,
  suggested: SkillLevel,
  explicit?: InteractionType | null,
): InteractionType {
  if (explicit === "accepted_unchanged" || explicit === "adjusted" || explicit === "rejected") {
    return explicit;
  }
  if (finalValue === null) return "rejected";
  if (finalValue === suggested) return "accepted_unchanged";
  return "adjusted";
}

export function listMatrixCells(matrix: Matrix): Array<{ developer_id: string; category_id: string }> {
  const cells: Array<{ developer_id: string; category_id: string }> = [];
  for (const [developer_id, byCategory] of Object.entries(matrix)) {
    for (const category_id of Object.keys(byCategory)) {
      cells.push({ developer_id, category_id });
    }
  }
  return cells;
}
