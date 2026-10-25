"use client";

// Client-side state: session ID and task 1 result are kept in sessionStorage
// so that an accidental reload does not break the flow. The authoritative copy
// still lives on the server.

import type { AiSuggestion, Matrix } from "./types";

const KEY_SESSION = "devskill.sessionId";
const KEY_CODE = "devskill.participantCode";
const KEY_TASK1 = "devskill.task1Matrix";
const KEY_TASK2 = "devskill.task2Matrix";
const KEY_SUGGESTIONS = "devskill.suggestions";
const KEY_PREFILL = "devskill.prefill";

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
  clear: () => {
    if (typeof window === "undefined") return;
    [KEY_SESSION, KEY_CODE, KEY_TASK1, KEY_TASK2, KEY_SUGGESTIONS, KEY_PREFILL].forEach(
      (k) => window.sessionStorage.removeItem(k),
    );
  },
};
