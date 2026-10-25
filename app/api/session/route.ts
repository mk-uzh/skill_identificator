import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAssessments } from "@/lib/assessments";
import { readSession, saveSession } from "@/lib/store";
import type { StudySession } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Creates a new study session and returns the session ID. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      participantCode?: string;
      condition?: string;
      consent?: boolean;
    };

    const participantCode = (body.participantCode ?? "").trim();
    if (!participantCode) {
      return NextResponse.json({ error: "Participant code missing" }, { status: 400 });
    }
    if (!body.consent) {
      return NextResponse.json({ error: "Consent missing" }, { status: 400 });
    }

    const assessments = getAssessments();
    const session: StudySession = {
      sessionId: randomUUID(),
      participantCode,
      condition: body.condition ?? "within-subjects",
      createdAt: new Date().toISOString(),
      userAgent: request.headers.get("user-agent") ?? "unknown",
      consent: true,
      config_hash: assessments.config_hash,
      snapshot_hash: assessments.config_hash,
    };

    await saveSession(session);
    return NextResponse.json({
      sessionId: session.sessionId,
      config_hash: session.config_hash,
      snapshot_hash: session.snapshot_hash,
    });
  } catch (error) {
    console.error("session route", error);
    return NextResponse.json({ error: "Could not create session" }, { status: 500 });
  }
}

/** Returns session status for client-side Task-2 gating. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Session ID missing" }, { status: 400 });
  }
  const session = await readSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json({
    sessionId: session.sessionId,
    participantCode: session.participantCode,
    task1Submitted: Boolean(session.task1),
    task2Submitted: Boolean(session.task2),
    task1Matrix: session.task1?.matrix ?? null,
    task2Matrix: session.task2?.matrix ?? null,
    config_hash: session.config_hash ?? null,
    snapshot_hash: session.snapshot_hash ?? null,
  });
}
