import { NextResponse } from "next/server";
import type { CellInteractionRow } from "@/lib/interaction-log";
import { appendInteractions, readSession } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Append-only interaction rows between blocks.
 *
 * The blocked flow finishes task 2 only after the last developer, but every
 * block produces cell rows that must not be lost if a participant stops half
 * way. This route appends them without touching the session document.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      rows?: CellInteractionRow[];
    };
    if (!body.sessionId) {
      return NextResponse.json({ error: "Session ID missing" }, { status: 400 });
    }
    const session = await readSession(body.sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    await appendInteractions(body.sessionId, body.rows ?? []);
    return NextResponse.json({ ok: true, appended: body.rows?.length ?? 0 });
  } catch (error) {
    console.error("interactions route", error);
    return NextResponse.json({ error: "Saving failed" }, { status: 500 });
  }
}
