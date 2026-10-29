/**
 * Seeds a complete fake study session so the section-6 CSV export can be tested
 * before any real participant exists.
 *
 * Usage: npm run seed
 * Then:  GET /api/export?token=<STUDY_ADMIN_TOKEN>&type=interactions
 */

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "study-data");

const LEVELS = ["none", "basic", "proficient", "expert"];

function isoOffset(baseMs, offsetMs) {
  return new Date(baseMs + offsetMs).toISOString();
}

async function main() {
  const assessmentsPath = path.join(DATA, "assessments.json");
  const assessments = JSON.parse(await fs.readFile(assessmentsPath, "utf8"));

  const sessionId = randomUUID();
  const participant_id = "FAKE-P01";
  const base = Date.now() - 20 * 60 * 1000;

  const task1Started = isoOffset(base, 0);
  const task1Submitted = isoOffset(base, 8 * 60 * 1000);
  const task2Started = isoOffset(base, 8 * 60 * 1000 + 5000);
  const task2Submitted = isoOffset(base, 16 * 60 * 1000);

  const task1Matrix = {};
  const task2Matrix = {};
  const suggestions = [];
  const outcomes = [];
  const interactions = [];

  let cellIndex = 0;
  for (const a of assessments.assessments) {
    const { developer_id, category_id, level, confidence } = a;
    if (!task1Matrix[developer_id]) task1Matrix[developer_id] = {};
    if (!task2Matrix[developer_id]) task2Matrix[developer_id] = {};

    // Plausible but clearly synthetic Task-1 values
    const task1Value = LEVELS[(cellIndex + 1) % LEVELS.length];
    task1Matrix[developer_id][category_id] = task1Value;

    const mode = cellIndex % 4;
    let finalValue = level;
    let interaction_type = "accepted_unchanged";
    let change_count = 1;
    let evidence_opened = false;
    let evidence_open_ms = 0;

    if (mode === 0) {
      interaction_type = "accepted_unchanged";
      finalValue = level;
      change_count = 1;
      evidence_opened = true;
      evidence_open_ms = 1200 + (cellIndex % 5) * 300;
    } else if (mode === 1) {
      interaction_type = "adjusted";
      finalValue = LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length];
      change_count = 2 + (cellIndex % 3);
      evidence_opened = true;
      evidence_open_ms = 2400;
    } else if (mode === 2) {
      interaction_type = "rejected";
      finalValue = null;
      change_count = 1;
      evidence_opened = false;
      evidence_open_ms = 0;
    } else {
      interaction_type = "accepted_unchanged";
      finalValue = level;
      change_count = 0;
      evidence_opened = true;
      evidence_open_ms = 800;
    }

    task2Matrix[developer_id][category_id] = finalValue;

    suggestions.push({
      devId: developer_id,
      categoryId: category_id,
      suggested: level,
      direction: a.study?.direction ?? "raise",
      confidence,
      rationale: a.rationale,
      evidence: a.evidence,
      veracity: a.study?.veracity ?? "correct",
    });

    outcomes.push({
      devId: developer_id,
      categoryId: category_id,
      suggested: level,
      veracity: a.study?.veracity ?? "correct",
      initialValue: task1Value,
      finalValue,
      decision: interaction_type,
      timeToDecisionMs: 1500 + cellIndex * 40,
      changeCount: change_count,
    });

    const opened_at = isoOffset(base, 8 * 60 * 1000 + 5000 + cellIndex * 1200);
    const committed_at = isoOffset(base, 8 * 60 * 1000 + 5000 + cellIndex * 1200 + 900);

    // Task 1 row
    interactions.push({
      session_id: sessionId,
      participant_id,
      task: 1,
      developer_id,
      category_id,
      suggested_level: null,
      suggested_confidence: null,
      task1_value: task1Value,
      final_value: task1Value,
      interaction_type: "set_manually",
      evidence_opened: false,
      evidence_open_ms: 0,
      opened_at: isoOffset(base, cellIndex * 900),
      committed_at: task1Submitted,
      change_count: 1 + (cellIndex % 2),
      correction_note: "",
    });

    // Task 2 row
    interactions.push({
      session_id: sessionId,
      participant_id,
      task: 2,
      developer_id,
      category_id,
      suggested_level: level,
      suggested_confidence: confidence,
      task1_value: task1Value,
      final_value: finalValue,
      interaction_type,
      evidence_opened,
      evidence_open_ms,
      opened_at,
      committed_at,
      change_count,
      correction_note:
        mode === 1
          ? "Synthetic objection: level overstates breadth in this category."
          : "",
    });

    cellIndex += 1;
  }

  const session = {
    sessionId,
    participantCode: participant_id,
    condition: "within-subjects",
    createdAt: task1Started,
    userAgent: "seed-fake-session/1.0",
    consent: true,
    config_hash: assessments.config_hash,
    snapshot_hash: assessments.config_hash,
    task1: {
      matrix: task1Matrix,
      startedAt: task1Started,
      submittedAt: task1Submitted,
      durationMs: 8 * 60 * 1000,
    },
    task2: {
      matrix: task2Matrix,
      startedAt: task2Started,
      submittedAt: task2Submitted,
      durationMs: 8 * 60 * 1000 - 5000,
      suggestions,
      outcomes,
    },
    survey: {
      trustInSystem: 4,
      confidenceTask1: 3,
      confidenceTask2: 4,
      perceivedUsefulness: 5,
      comment: "Synthetic seed session for export testing.",
    },
  };

  const events = [
    {
      ts: task1Started,
      tMs: 0,
      sessionId,
      task: 1,
      type: "task_start",
      meta: { task: 1 },
    },
    {
      ts: task1Submitted,
      tMs: 8 * 60 * 1000,
      sessionId,
      task: 1,
      type: "task_submit",
      meta: { task: 1, durationMs: 8 * 60 * 1000 },
    },
    {
      ts: task2Started,
      tMs: 0,
      sessionId,
      task: 2,
      type: "task_start",
      meta: { task: 2 },
    },
    {
      ts: task2Submitted,
      tMs: 8 * 60 * 1000 - 5000,
      sessionId,
      task: 2,
      type: "task_submit",
      meta: { task: 2 },
    },
  ];

  await fs.mkdir(path.join(DATA, "sessions"), { recursive: true });
  await fs.mkdir(path.join(DATA, "events"), { recursive: true });
  await fs.mkdir(path.join(DATA, "interactions"), { recursive: true });

  await fs.writeFile(
    path.join(DATA, "sessions", `${sessionId}.json`),
    JSON.stringify(session, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(DATA, "events", `${sessionId}.jsonl`),
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(DATA, "interactions", `${sessionId}.jsonl`),
    interactions.map((r) => JSON.stringify(r)).join("\n") + "\n",
    "utf8",
  );

  const required = [
    "session_id",
    "participant_id",
    "task",
    "developer_id",
    "category_id",
    "suggested_level",
    "suggested_confidence",
    "task1_value",
    "final_value",
    "interaction_type",
    "evidence_opened",
    "evidence_open_ms",
    "opened_at",
    "committed_at",
    "change_count",
    "correction_note",
  ];

  for (const row of interactions) {
    for (const key of required) {
      if (!(key in row)) {
        throw new Error(`Seed row missing field ${key}`);
      }
    }
  }

  console.log("Seeded fake session:");
  console.log(`  session_id:     ${sessionId}`);
  console.log(`  participant_id: ${participant_id}`);
  console.log(`  interactions:   ${interactions.length} rows (task1+task2 × cells)`);
  console.log("");
  console.log("Export CSV:");
  console.log(
    `  GET /api/export?token=<STUDY_ADMIN_TOKEN>&type=interactions`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
