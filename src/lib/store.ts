// ---------------------------------------------------------------------------
// File-based persistence (server side).
//
// Deliberately kept simple: one JSON file per session with the results and one
// JSONL file with the complete interaction log. For a study with a few dozen
// participants this is entirely sufficient, and it can later be swapped for
// SQLite or Postgres without changing the API routes.
// ---------------------------------------------------------------------------

import { promises as fs } from "node:fs";
import path from "node:path";
import type { StudyEvent, StudySession } from "./types";

const DATA_DIR = process.env.STUDY_DATA_DIR
  ? path.resolve(process.env.STUDY_DATA_DIR)
  : path.join(process.cwd(), "data");

const SESSIONS_DIR = path.join(DATA_DIR, "sessions");
const EVENTS_DIR = path.join(DATA_DIR, "events");

/** Prevents path traversal via manipulated session IDs. */
function safeId(id: string): string {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
    throw new Error("Invalid session ID");
  }
  return id;
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  await fs.mkdir(EVENTS_DIR, { recursive: true });
}

export async function saveSession(session: StudySession): Promise<void> {
  await ensureDirs();
  const file = path.join(SESSIONS_DIR, `${safeId(session.sessionId)}.json`);
  await fs.writeFile(file, JSON.stringify(session, null, 2), "utf8");
}

export async function readSession(sessionId: string): Promise<StudySession | null> {
  try {
    const file = path.join(SESSIONS_DIR, `${safeId(sessionId)}.json`);
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as StudySession;
  } catch {
    return null;
  }
}

export async function updateSession(
  sessionId: string,
  patch: Partial<StudySession>,
): Promise<StudySession> {
  const existing = await readSession(sessionId);
  if (!existing) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const merged: StudySession = { ...existing, ...patch };
  await saveSession(merged);
  return merged;
}

export async function appendEvents(sessionId: string, events: StudyEvent[]): Promise<void> {
  if (events.length === 0) return;
  await ensureDirs();
  const file = path.join(EVENTS_DIR, `${safeId(sessionId)}.jsonl`);
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fs.appendFile(file, lines, "utf8");
}

export async function listSessions(): Promise<StudySession[]> {
  await ensureDirs();
  const files = await fs.readdir(SESSIONS_DIR);
  const sessions: StudySession[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(SESSIONS_DIR, f), "utf8");
      sessions.push(JSON.parse(raw) as StudySession);
    } catch {
      // skip corrupted file, the export must not abort
    }
  }
  return sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function readEvents(sessionId: string): Promise<StudyEvent[]> {
  try {
    const file = path.join(EVENTS_DIR, `${safeId(sessionId)}.jsonl`);
    const raw = await fs.readFile(file, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as StudyEvent);
  } catch {
    return [];
  }
}
