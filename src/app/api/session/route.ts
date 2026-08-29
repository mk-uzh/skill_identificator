import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { saveSession } from "@/lib/store";
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

    const session: StudySession = {
      sessionId: randomUUID(),
      participantCode,
      condition: body.condition ?? "within-subjects",
      createdAt: new Date().toISOString(),
      userAgent: request.headers.get("user-agent") ?? "unknown",
      consent: true,
    };

    await saveSession(session);
    return NextResponse.json({ sessionId: session.sessionId });
  } catch (error) {
    console.error("session route", error);
    return NextResponse.json({ error: "Could not create session" }, { status: 500 });
  }
}
