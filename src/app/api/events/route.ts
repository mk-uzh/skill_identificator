import { NextResponse } from "next/server";
import { appendEvents } from "@/lib/store";
import type { StudyEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Accepts batched interaction events and appends them to the log. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string; events?: StudyEvent[] };
    if (!body.sessionId || !Array.isArray(body.events)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // add a server timestamp so client clocks can be corrected later
    const receivedAt = new Date().toISOString();
    const events = body.events.map((e) => ({ ...e, meta: { ...e.meta, receivedAt } }));

    await appendEvents(body.sessionId, events);
    return NextResponse.json({ ok: true, count: events.length });
  } catch (error) {
    console.error("events route", error);
    return NextResponse.json({ error: "Could not store events" }, { status: 500 });
  }
}
