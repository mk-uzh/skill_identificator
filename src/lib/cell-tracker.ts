"use client";

// Per-cell timing and interaction state for the section-6 log.

import {
  cellKey,
  nowIsoMs,
  resolveTask2InteractionType,
  type CellInteractionRow,
  type InteractionType,
} from "./interaction-log";
import type { AiSuggestion, Matrix, SkillLevel } from "./types";

interface CellState {
  opened_at: string | null;
  change_count: number;
  evidence_opened: boolean;
  evidence_open_ms: number;
  evidenceStartedAt: number | null;
  explicitType: InteractionType | null;
  correction_note: string;
}

function emptyCell(): CellState {
  return {
    opened_at: null,
    change_count: 0,
    evidence_opened: false,
    evidence_open_ms: 0,
    evidenceStartedAt: null,
    explicitType: null,
    correction_note: "",
  };
}

export class CellTracker {
  private cells = new Map<string, CellState>();

  private ensure(developerId: string, categoryId: string): CellState {
    const key = cellKey(developerId, categoryId);
    let state = this.cells.get(key);
    if (!state) {
      state = emptyCell();
      this.cells.set(key, state);
    }
    return state;
  }

  /** First focus / open of a cell — records opened_at once. */
  open(developerId: string, categoryId: string): void {
    const state = this.ensure(developerId, categoryId);
    if (!state.opened_at) {
      state.opened_at = nowIsoMs();
    }
  }

  change(developerId: string, categoryId: string): void {
    const state = this.ensure(developerId, categoryId);
    if (!state.opened_at) {
      state.opened_at = nowIsoMs();
    }
    state.change_count += 1;
  }

  setExplicitType(developerId: string, categoryId: string, type: InteractionType): void {
    const state = this.ensure(developerId, categoryId);
    state.explicitType = type;
  }

  evidenceOpen(developerId: string, categoryId: string): void {
    const state = this.ensure(developerId, categoryId);
    state.evidence_opened = true;
    if (state.evidenceStartedAt === null) {
      state.evidenceStartedAt = Date.now();
    }
  }

  evidenceClose(developerId: string, categoryId: string): void {
    const state = this.ensure(developerId, categoryId);
    if (state.evidenceStartedAt !== null) {
      state.evidence_open_ms += Date.now() - state.evidenceStartedAt;
      state.evidenceStartedAt = null;
    }
  }

  getChangeCount(developerId: string, categoryId: string): number {
    return this.ensure(developerId, categoryId).change_count;
  }

  setCorrectionNote(developerId: string, categoryId: string, note: string): void {
    this.ensure(developerId, categoryId).correction_note = note;
  }

  /** Close any open evidence timers before building rows. */
  flushEvidenceTimers(): void {
    Array.from(this.cells.values()).forEach((state) => {
      if (state.evidenceStartedAt !== null) {
        state.evidence_open_ms += Date.now() - state.evidenceStartedAt;
        state.evidenceStartedAt = null;
      }
    });
  }

  buildTask1Rows(args: {
    sessionId: string;
    participantId: string;
    matrix: Matrix;
    committedAt?: string;
  }): CellInteractionRow[] {
    this.flushEvidenceTimers();
    const committed_at = args.committedAt ?? nowIsoMs();
    const rows: CellInteractionRow[] = [];

    for (const [developer_id, byCategory] of Object.entries(args.matrix)) {
      for (const [category_id, final_value] of Object.entries(byCategory)) {
        const state = this.ensure(developer_id, category_id);
        rows.push({
          session_id: args.sessionId,
          participant_id: args.participantId,
          task: 1,
          developer_id,
          category_id,
          suggested_level: null,
          suggested_confidence: null,
          task1_value: final_value,
          final_value,
          interaction_type: "set_manually",
          evidence_opened: state.evidence_opened,
          evidence_open_ms: state.evidence_open_ms,
          opened_at: state.opened_at ?? committed_at,
          committed_at,
          change_count: state.change_count,
          correction_note: "",
        });
      }
    }
    return rows;
  }

  buildTask2Rows(args: {
    sessionId: string;
    participantId: string;
    matrix: Matrix;
    task1: Matrix;
    suggestions: Map<string, AiSuggestion>;
    committedAt?: string;
  }): CellInteractionRow[] {
    this.flushEvidenceTimers();
    const committed_at = args.committedAt ?? nowIsoMs();
    const rows: CellInteractionRow[] = [];

    for (const [developer_id, byCategory] of Object.entries(args.matrix)) {
      for (const category_id of Object.keys(byCategory)) {
        const key = cellKey(developer_id, category_id);
        const suggestion = args.suggestions.get(key);
        const final_value = args.matrix[developer_id]?.[category_id] ?? null;
        const task1_value = args.task1[developer_id]?.[category_id] ?? null;
        const state = this.ensure(developer_id, category_id);
        const suggested = suggestion?.suggested ?? ("basic" as SkillLevel);

        rows.push({
          session_id: args.sessionId,
          participant_id: args.participantId,
          task: 2,
          developer_id,
          category_id,
          suggested_level: suggestion?.suggested ?? null,
          suggested_confidence: suggestion?.confidence ?? null,
          task1_value,
          final_value,
          interaction_type: resolveTask2InteractionType(
            final_value,
            suggested,
            state.explicitType,
          ),
          evidence_opened: state.evidence_opened,
          evidence_open_ms: state.evidence_open_ms,
          opened_at: state.opened_at ?? committed_at,
          committed_at,
          change_count: state.change_count,
          correction_note: state.correction_note,
        });
      }
    }
    return rows;
  }
}
