import { NextResponse } from "next/server";
import type { CellInteractionRow } from "@/lib/interaction-log";
import { parseProject } from "@/lib/project";
import { appendInteractions, readSession, updateSession } from "@/lib/store";
import {
  assessmentsToMatrix,
  buildSuggestionsFromAssessments,
} from "@/lib/suggestions";
import type { AiSuggestion, Matrix, SuggestionOutcome, SurveyAnswers } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SubmitBody {
  sessionId?: string;
  task?: 1 | 2;
  matrix?: Matrix;
  durationMs?: number;
  startedAt?: string;
  suggestions?: AiSuggestion[];
  outcomes?: SuggestionOutcome[];
  interactions?: CellInteractionRow[];
  survey?: SurveyAnswers;
  /** Allow re-running Task 1 before Task 2 is finished (recalculates suggestions). */
  recalculate?: boolean;
  /** Prototype shortcut: the run was cut short and must not be analysed. */
  prototypeSkip?: boolean;
}

/**
 * Stores the result of a task.
 * Task 1 may be re-submitted while Task 2 is not finished — clears Task 2 and recalculates.
 * Task 2 requires Task 1 and locks once submitted.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmitBody;
    if (!body.sessionId) {
      return NextResponse.json({ error: "Session ID missing" }, { status: 400 });
    }

    const session = await readSession(body.sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (body.survey) {
      await updateSession(body.sessionId, { survey: body.survey });
      return NextResponse.json({ ok: true });
    }

    if (!body.matrix || (body.task !== 1 && body.task !== 2)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const submittedAt = new Date().toISOString();
    const startedAt = body.startedAt ?? submittedAt;

    if (body.task === 1) {
      if (session.task2) {
        return NextResponse.json(
          { error: "Task 1 is locked after Task 2 was submitted" },
          { status: 409 },
        );
      }

      // Re-submit / back-and-forward: replace Task 1 and clear any partial Task 2.
      await updateSession(body.sessionId, {
        task1: {
          matrix: body.matrix,
          startedAt,
          submittedAt,
          durationMs: body.durationMs ?? 0,
        },
        task2: undefined,
      });

      if (body.interactions?.length) {
        await appendInteractions(body.sessionId, body.interactions);
      }

      // Suggestions from assessments.json — synchronous, no heavy compute.
      const project = parseProject(session.project);
      const suggestions = buildSuggestionsFromAssessments(project);
      const prefill = assessmentsToMatrix(project);
      return NextResponse.json({
        ok: true,
        suggestions,
        prefill,
        recalculated: Boolean(session.task1),
      });
    }

    // Task 2
    if (!session.task1) {
      return NextResponse.json(
        { error: "Task 2 is unreachable until Task 1 is submitted" },
        { status: 403 },
      );
    }
    if (session.task2) {
      return NextResponse.json({ error: "Task 2 is locked" }, { status: 409 });
    }

    await updateSession(body.sessionId, {
      ...(body.prototypeSkip ? { prototype_skip: true } : {}),
      task2: {
        matrix: body.matrix,
        startedAt,
        submittedAt,
        durationMs: body.durationMs ?? 0,
        suggestions: body.suggestions ?? [],
        outcomes: body.outcomes ?? [],
      },
    });

    if (body.interactions?.length) {
      await appendInteractions(body.sessionId, body.interactions);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("submit route", error);
    return NextResponse.json({ error: "Saving failed" }, { status: 500 });
  }
}
