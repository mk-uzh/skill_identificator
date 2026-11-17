import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAssessments } from "@/lib/assessments";
import { listSessions, readSession, saveSession, readInteractions } from "@/lib/store";
import { parseProject } from "@/lib/project";
import { BLOCK_COUNT, leastFilled, poolFor } from "@/lib/study-flow";
import { versionFor } from "@/lib/study-script";
import type { ParticipantProfile, StudySession } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Creates a new study session and returns the session ID. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      participantCode?: string;
      condition?: string;
      consent?: boolean;
      terms?: boolean;
      project?: string;
      profile?: ParticipantProfile;
      /** Moderator override, must be a developer of the pool of the project. */
      developer?: string;
    };

    const participantCode = (body.participantCode ?? "").trim();
    if (!participantCode) {
      return NextResponse.json({ error: "Participant code missing" }, { status: 400 });
    }
    if (!body.consent) {
      return NextResponse.json({ error: "Consent missing" }, { status: 400 });
    }

    if (!body.terms) {
      return NextResponse.json({ error: "Terms of use not confirmed" }, { status: 400 });
    }

    const project = parseProject(body.project);
    const assessments = getAssessments(project);

    // Balanced assignment: count participants per developer in this project,
    // completed ones and those still running (started less than two hours ago),
    // and give the next participant the developer with the fewest.
    const pool = poolFor(project);
    const counts: Record<string, number> = Object.fromEntries(pool.map((id) => [id, 0]));
    const now = Date.now();
    for (const other of await listSessions()) {
      if (other.project !== project || other.prototype_skip) continue;
      const first = other.devOrder?.[0];
      if (!first || !(first in counts)) continue;
      const running = !other.task2 && now - Date.parse(other.createdAt) < 2 * 60 * 60 * 1000;
      if (other.task2 || running) counts[first] += 1;
    }
    const manual = body.developer && pool.includes(body.developer) ? body.developer : null;
    const devOrder = manual ? [manual] : [leastFilled(pool, counts)];
    const session: StudySession = {
      sessionId: randomUUID(),
      participantCode,
      condition: body.condition ?? "within-subjects",
      createdAt: new Date().toISOString(),
      userAgent: request.headers.get("user-agent") ?? "unknown",
      consent: true,
      termsAccepted: true,
      profile: body.profile,
      project,
      config_hash: assessments.config_hash,
      snapshot_hash: assessments.config_hash,
      devOrder: devOrder.slice(0, BLOCK_COUNT),
      assignment: manual ? "manual" : "least_filled",
      variant: versionFor(participantCode),
    };

    await saveSession(session);
    return NextResponse.json({
      sessionId: session.sessionId,
      config_hash: session.config_hash,
      snapshot_hash: session.snapshot_hash,
      devOrder: session.devOrder,
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
  const interactions = await readInteractions(sessionId);
  const last = new Map<string, { task: number; devId: string; categoryId: string; seconds: number }>();
  for (const r of interactions) {
    const ms = Date.parse(r.committed_at) - Date.parse(r.opened_at);
    if (!Number.isFinite(ms) || ms < 0) continue;
    last.set(`${r.task}::${r.developer_id}::${r.category_id}`, {
      task: r.task,
      devId: r.developer_id,
      categoryId: r.category_id,
      seconds: Math.round(ms / 100) / 10,
    });
  }
  return NextResponse.json({
    cellSeconds: Array.from(last.values()),
    sessionId: session.sessionId,
    participantCode: session.participantCode,
    task1Submitted: Boolean(session.task1),
    task2Submitted: Boolean(session.task2),
    devOrder: session.devOrder ?? null,
    outcomes: session.task2?.outcomes ?? null,
    prototypeSkip: Boolean(session.prototype_skip),
    task1Matrix: session.task1?.matrix ?? null,
    task2Matrix: session.task2?.matrix ?? null,
    config_hash: session.config_hash ?? null,
    snapshot_hash: session.snapshot_hash ?? null,
  });
}
