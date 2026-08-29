import { NextResponse } from "next/server";
import { updateSession } from "@/lib/store";
import { buildSuggestions } from "@/lib/suggestions";
import type { AiSuggestion, Matrix, SuggestionOutcome, SurveyAnswers } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SubmitBody {
  sessionId?: string;
  task?: 1 | 2;
  matrix?: Matrix;
  durationMs?: number;
  suggestions?: AiSuggestion[];
  outcomes?: SuggestionOutcome[];
  survey?: SurveyAnswers;
}

/**
 * Stores the result of a task.
 * After task 1 the AI suggestions for task 2 are additionally computed and
 * returned – deliberately on the server so that the suggestion logic is not
 * inspectable in the browser.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmitBody;
    if (!body.sessionId) {
      return NextResponse.json({ error: "Session ID missing" }, { status: 400 });
    }

    // final questionnaire
    if (body.survey) {
      await updateSession(body.sessionId, { survey: body.survey });
      return NextResponse.json({ ok: true });
    }

    if (!body.matrix || (body.task !== 1 && body.task !== 2)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const submittedAt = new Date().toISOString();

    if (body.task === 1) {
      await updateSession(body.sessionId, {
        task1: { matrix: body.matrix, submittedAt, durationMs: body.durationMs ?? 0 },
      });
      const suggestions = buildSuggestions(body.matrix);
      return NextResponse.json({ ok: true, suggestions });
    }

    await updateSession(body.sessionId, {
      task2: {
        matrix: body.matrix,
        submittedAt,
        durationMs: body.durationMs ?? 0,
        suggestions: body.suggestions ?? [],
        outcomes: body.outcomes ?? [],
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("submit route", error);
    return NextResponse.json({ error: "Saving failed" }, { status: 500 });
  }
}
