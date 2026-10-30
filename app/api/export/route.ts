import { NextResponse } from "next/server";
import {
  INTERACTION_CSV_HEADERS,
  type CellInteractionRow,
} from "@/lib/interaction-log";
import { listSessions, readEvents, readInteractions } from "@/lib/store";
import { SKILL_LEVEL_VALUE } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0 && !headers) return "";
  const cols = headers ?? (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

function interactionToRecord(row: CellInteractionRow): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const key of INTERACTION_CSV_HEADERS) {
    record[key] = row[key];
  }
  return record;
}

/**
 * Data export for the analysis.
 *
 *   /api/export?token=...&type=interactions  -> section-6 cell log (primary)
 *   /api/export?token=...&type=ratings       -> long format: one row per cell and task
 *   /api/export?token=...&type=suggestions   -> one row per AI suggestion incl. decision
 *   /api/export?token=...&type=sessions      -> overview incl. questionnaire + hashes
 *   /api/export?token=...&type=events        -> fine-grained UI event log
 *   /api/export?token=...&type=raw           -> everything as JSON
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expected = process.env.STUDY_ADMIN_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const type = url.searchParams.get("type") ?? "interactions";
  const sessions = await listSessions();

  if (type === "raw") {
    const withExtras = await Promise.all(
      sessions.map(async (s) => ({
        ...s,
        events: await readEvents(s.sessionId),
        interactions: await readInteractions(s.sessionId),
      })),
    );
    return NextResponse.json(withExtras);
  }

  if (type === "interactions") {
    const rows: Record<string, unknown>[] = [];
    for (const s of sessions) {
      for (const row of await readInteractions(s.sessionId)) {
        rows.push(interactionToRecord(row));
      }
    }
    return csvResponse(
      toCsv(rows, [...INTERACTION_CSV_HEADERS]),
      "interactions.csv",
    );
  }

  if (type === "sessions") {
    const rows = sessions.map((s) => ({
      session_id: s.sessionId,
      participant_id: s.participantCode,
      condition: s.condition,
      project: s.project ?? "sakai",
      created_at: s.createdAt,
      config_hash: s.config_hash ?? "",
      snapshot_hash: s.snapshot_hash ?? "",
      task1_started_at: s.task1?.startedAt ?? "",
      task1_submitted_at: s.task1?.submittedAt ?? "",
      task1_duration_ms: s.task1?.durationMs ?? "",
      task2_started_at: s.task2?.startedAt ?? "",
      task2_submitted_at: s.task2?.submittedAt ?? "",
      task2_duration_ms: s.task2?.durationMs ?? "",
      trustInSystem: s.survey?.trustInSystem ?? "",
      confidenceTask1: s.survey?.confidenceTask1 ?? "",
      confidenceTask2: s.survey?.confidenceTask2 ?? "",
      perceivedUsefulness: s.survey?.perceivedUsefulness ?? "",
      visibilityPreference: s.survey?.visibilityPreference ?? "",
      visibilityReason: s.survey?.visibilityReason ?? "",
      comment: s.survey?.comment ?? "",
    }));
    return csvResponse(toCsv(rows), "sessions.csv");
  }

  if (type === "suggestions") {
    const rows = sessions.flatMap((s) =>
      (s.task2?.outcomes ?? []).map((o) => ({
        session_id: s.sessionId,
        participant_id: s.participantCode,
        developer_id: o.devId,
        category_id: o.categoryId,
        suggested_level: o.suggested,
        veracity: o.veracity,
        task1_value: o.initialValue ?? "",
        final_value: o.finalValue ?? "",
        followed_suggestion: o.finalValue === o.suggested ? 1 : 0,
        interaction_type: o.decision,
        time_to_decision_ms: o.timeToDecisionMs ?? "",
        change_count: o.changeCount,
      })),
    );
    return csvResponse(toCsv(rows), "suggestions.csv");
  }

  if (type === "events") {
    const rows: Record<string, unknown>[] = [];
    for (const s of sessions) {
      for (const e of await readEvents(s.sessionId)) {
        rows.push({
          session_id: e.sessionId,
          participant_id: s.participantCode,
          ts: e.ts,
          t_ms: e.tMs,
          task: e.task,
          type: e.type,
          developer_id: e.devId ?? "",
          category_id: e.categoryId ?? "",
          from: e.from ?? "",
          to: e.to ?? "",
          suggested: e.suggested ?? "",
        });
      }
    }
    return csvResponse(toCsv(rows), "events.csv");
  }

  // ratings in long format
  const rows: Record<string, unknown>[] = [];
  for (const s of sessions) {
    for (const task of [1, 2] as const) {
      const data = task === 1 ? s.task1 : s.task2;
      if (!data) continue;
      for (const [devId, byCategory] of Object.entries(data.matrix)) {
        for (const [categoryId, level] of Object.entries(byCategory)) {
          rows.push({
            session_id: s.sessionId,
            participant_id: s.participantCode,
            task,
            developer_id: devId,
            category_id: categoryId,
            level: level ?? "",
            level_value: level ? SKILL_LEVEL_VALUE[level] : "",
          });
        }
      }
    }
  }
  return csvResponse(toCsv(rows), "ratings.csv");
}

function csvResponse(csv: string, filename: string): Response {
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
