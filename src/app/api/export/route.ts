import { NextResponse } from "next/server";
import { listSessions, readEvents } from "@/lib/store";
import { SKILL_LEVEL_VALUE } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

/**
 * Data export for the analysis.
 *
 *   /api/export?token=...&type=ratings      -> long format: one row per cell and task
 *   /api/export?token=...&type=suggestions  -> one row per AI suggestion incl. decision
 *   /api/export?token=...&type=sessions     -> overview incl. questionnaire
 *   /api/export?token=...&type=events       -> complete interaction log
 *   /api/export?token=...&type=raw          -> everything as JSON
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expected = process.env.STUDY_ADMIN_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const type = url.searchParams.get("type") ?? "ratings";
  const sessions = await listSessions();

  if (type === "raw") {
    const withEvents = await Promise.all(
      sessions.map(async (s) => ({ ...s, events: await readEvents(s.sessionId) })),
    );
    return NextResponse.json(withEvents);
  }

  if (type === "sessions") {
    const rows = sessions.map((s) => ({
      sessionId: s.sessionId,
      participantCode: s.participantCode,
      condition: s.condition,
      createdAt: s.createdAt,
      task1SubmittedAt: s.task1?.submittedAt ?? "",
      task1DurationMs: s.task1?.durationMs ?? "",
      task2SubmittedAt: s.task2?.submittedAt ?? "",
      task2DurationMs: s.task2?.durationMs ?? "",
      suggestionsShown: s.task2?.outcomes.length ?? "",
      suggestionsAccepted: s.task2?.outcomes.filter((o) => o.decision === "accepted").length ?? "",
      suggestionsDismissed: s.task2?.outcomes.filter((o) => o.decision === "dismissed").length ?? "",
      suggestionsModified: s.task2?.outcomes.filter((o) => o.decision === "modified").length ?? "",
      trustInSystem: s.survey?.trustInSystem ?? "",
      confidenceTask1: s.survey?.confidenceTask1 ?? "",
      confidenceTask2: s.survey?.confidenceTask2 ?? "",
      perceivedUsefulness: s.survey?.perceivedUsefulness ?? "",
      comment: s.survey?.comment ?? "",
    }));
    return csvResponse(toCsv(rows), "sessions.csv");
  }

  if (type === "suggestions") {
    const rows = sessions.flatMap((s) =>
      (s.task2?.outcomes ?? []).map((o) => ({
        sessionId: s.sessionId,
        participantCode: s.participantCode,
        devId: o.devId,
        categoryId: o.categoryId,
        suggested: o.suggested,
        veracity: o.veracity,
        initialValue: o.initialValue ?? "",
        finalValue: o.finalValue ?? "",
        followedSuggestion: o.finalValue === o.suggested ? 1 : 0,
        decision: o.decision,
        timeToDecisionMs: o.timeToDecisionMs ?? "",
        changeCount: o.changeCount,
      })),
    );
    return csvResponse(toCsv(rows), "suggestions.csv");
  }

  if (type === "events") {
    const rows: Record<string, unknown>[] = [];
    for (const s of sessions) {
      for (const e of await readEvents(s.sessionId)) {
        rows.push({
          sessionId: e.sessionId,
          participantCode: s.participantCode,
          ts: e.ts,
          tMs: e.tMs,
          task: e.task,
          type: e.type,
          devId: e.devId ?? "",
          categoryId: e.categoryId ?? "",
          from: e.from ?? "",
          to: e.to ?? "",
          suggested: e.suggested ?? "",
        });
      }
    }
    return csvResponse(toCsv(rows), "events.csv");
  }

  // default: ratings in long format
  const rows: Record<string, unknown>[] = [];
  for (const s of sessions) {
    for (const task of [1, 2] as const) {
      const data = task === 1 ? s.task1 : s.task2;
      if (!data) continue;
      for (const [devId, byCategory] of Object.entries(data.matrix)) {
        for (const [categoryId, level] of Object.entries(byCategory)) {
          rows.push({
            sessionId: s.sessionId,
            participantCode: s.participantCode,
            task,
            devId,
            categoryId,
            level: level ?? "",
            levelValue: level ? SKILL_LEVEL_VALUE[level] : "",
          });
        }
      }
    }
  }
  return csvResponse(toCsv(rows), "ratings.csv");
}

function csvResponse(csv: string, filename: string): Response {
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
