"use client";

// Client-side state: session ID and task 1 result are kept in sessionStorage
// so that an accidental reload does not break the flow. The authoritative copy
// still lives on the server.

import type { AiSuggestion, Matrix, SuggestionOutcome } from "./types";

const KEY_SESSION = "devskill.sessionId";
const KEY_CODE = "devskill.participantCode";
const KEY_TASK1 = "devskill.task1Matrix";
const KEY_TASK2 = "devskill.task2Matrix";
const KEY_SUGGESTIONS = "devskill.suggestions";
const KEY_PREFILL = "devskill.prefill";
// Blocked flow: decisions accumulate across blocks, task 2 is only sent after the last one.
const KEY_OUTCOMES = "devskill.outcomes";
// A task now runs over several blocks, so its duration and start time have
// to be accumulated client side rather than taken from one page visit.
const KEY_MS = ["devskill.msTask1", "devskill.msTask2"] as const;
const KEY_START = ["devskill.startTask1", "devskill.startTask2"] as const;

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage can fail in private mode – the server holds the data
  }
}

export const clientSession = {
  getSessionId: () => read<string>(KEY_SESSION),
  setSessionId: (id: string) => write(KEY_SESSION, id),
  getParticipantCode: () => read<string>(KEY_CODE),
  setParticipantCode: (code: string) => write(KEY_CODE, code),
  getTask1: () => read<Matrix>(KEY_TASK1),
  setTask1: (matrix: Matrix) => write(KEY_TASK1, matrix),
  getTask2: () => read<Matrix>(KEY_TASK2),
  setTask2: (matrix: Matrix) => write(KEY_TASK2, matrix),
  getSuggestions: () => read<AiSuggestion[]>(KEY_SUGGESTIONS),
  setSuggestions: (s: AiSuggestion[]) => write(KEY_SUGGESTIONS, s),
  getPrefill: () => read<Matrix>(KEY_PREFILL),
  setPrefill: (m: Matrix) => write(KEY_PREFILL, m),
  getOutcomes: () => read<SuggestionOutcome[]>(KEY_OUTCOMES) ?? [],
  setOutcomes: (o: SuggestionOutcome[]) => write(KEY_OUTCOMES, o),
  /** Total time spent in a task so far, summed over all blocks. */
  getElapsed: (task: 1 | 2) => read<number>(KEY_MS[task - 1]) ?? 0,
  addElapsed: (task: 1 | 2, ms: number) =>
    write(KEY_MS[task - 1], (read<number>(KEY_MS[task - 1]) ?? 0) + ms),
  /** Start of the FIRST block of a task; later blocks must not overwrite it. */
  getStart: (task: 1 | 2, fallback: string) =>
    read<string>(KEY_START[task - 1]) ?? fallback,
  setStartOnce: (task: 1 | 2, iso: string) => {
    if (read<string>(KEY_START[task - 1]) == null) write(KEY_START[task - 1], iso);
  },
  clear: () => {
    if (typeof window === "undefined") return;
    [
      KEY_SESSION,
      KEY_CODE,
      KEY_TASK1,
      KEY_TASK2,
      KEY_SUGGESTIONS,
      KEY_PREFILL,
      KEY_OUTCOMES,
      ...KEY_MS,
      ...KEY_START,
    ].forEach(
      (k) => window.sessionStorage.removeItem(k),
    );
  },
};
