// ---------------------------------------------------------------------------
// Assessments contract (M1)
//
// data/assessments.json is the single interface between inference and UI.
// This module loads and validates it; malformed files fail loudly.
// ---------------------------------------------------------------------------

import rawAssessments from "../../data/assessments.json";
import { SKILL_LEVELS, type SkillLevel } from "./types";

const EVIDENCE_KINDS = ["commit", "pull_request", "review", "issue"] as const;
const STUDY_DIRECTIONS = ["raise", "lower"] as const;
const STUDY_VERACITIES = ["correct", "incorrect"] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface EvidenceItem {
  kind: EvidenceKind;
  title: string;
  timestamp: string;
  url: string;
}

export interface StudyScriptMeta {
  direction: "raise" | "lower";
  delta: number;
  veracity: "correct" | "incorrect";
}

export interface Assessment {
  id: string;
  developer_id: string;
  category_id: string;
  level: SkillLevel;
  confidence: number;
  rationale: string;
  evidence: EvidenceItem[];
  /** Optional study-design knobs for scripted Task-2 suggestions. */
  study?: StudyScriptMeta;
}

export interface AssessmentsFile {
  taxonomy_version: string;
  organization_id: string;
  computed_at: string;
  config_hash: string;
  assessments: Assessment[];
}

export class AssessmentsSchemaError extends Error {
  constructor(message: string) {
    super(`[assessments.json] ${message}`);
    this.name = "AssessmentsSchemaError";
  }
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AssessmentsSchemaError(`${label} must be an object`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AssessmentsSchemaError(`${label} must be a non-empty string`);
  }
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new AssessmentsSchemaError(`${label} must be a number`);
  }
}

function isSkillLevel(value: string): value is SkillLevel {
  return (SKILL_LEVELS as readonly string[]).includes(value);
}

function isEvidenceKind(value: string): value is EvidenceKind {
  return (EVIDENCE_KINDS as readonly string[]).includes(value);
}

function validateEvidenceItem(raw: unknown, label: string): EvidenceItem {
  assertObject(raw, label);
  assertString(raw.kind, `${label}.kind`);
  if (!isEvidenceKind(raw.kind)) {
    throw new AssessmentsSchemaError(
      `${label}.kind must be one of ${EVIDENCE_KINDS.join(", ")} (got "${raw.kind}")`,
    );
  }
  assertString(raw.title, `${label}.title`);
  assertString(raw.timestamp, `${label}.timestamp`);
  if (Number.isNaN(Date.parse(raw.timestamp))) {
    throw new AssessmentsSchemaError(`${label}.timestamp must be a valid ISO timestamp`);
  }
  assertString(raw.url, `${label}.url`);
  try {
    // eslint-disable-next-line no-new
    new URL(raw.url);
  } catch {
    throw new AssessmentsSchemaError(`${label}.url must be an absolute URL`);
  }
  return {
    kind: raw.kind,
    title: raw.title,
    timestamp: raw.timestamp,
    url: raw.url,
  };
}

function validateStudy(raw: unknown, label: string): StudyScriptMeta {
  assertObject(raw, label);
  assertString(raw.direction, `${label}.direction`);
  if (!(STUDY_DIRECTIONS as readonly string[]).includes(raw.direction)) {
    throw new AssessmentsSchemaError(
      `${label}.direction must be "raise" or "lower" (got "${raw.direction}")`,
    );
  }
  assertNumber(raw.delta, `${label}.delta`);
  if (!Number.isInteger(raw.delta) || raw.delta < 1) {
    throw new AssessmentsSchemaError(`${label}.delta must be an integer >= 1`);
  }
  assertString(raw.veracity, `${label}.veracity`);
  if (!(STUDY_VERACITIES as readonly string[]).includes(raw.veracity)) {
    throw new AssessmentsSchemaError(
      `${label}.veracity must be "correct" or "incorrect" (got "${raw.veracity}")`,
    );
  }
  return {
    direction: raw.direction as StudyScriptMeta["direction"],
    delta: raw.delta,
    veracity: raw.veracity as StudyScriptMeta["veracity"],
  };
}

function validateAssessment(raw: unknown, index: number): Assessment {
  const label = `assessments[${index}]`;
  assertObject(raw, label);
  assertString(raw.id, `${label}.id`);
  assertString(raw.developer_id, `${label}.developer_id`);
  assertString(raw.category_id, `${label}.category_id`);
  assertString(raw.level, `${label}.level`);
  if (!isSkillLevel(raw.level)) {
    throw new AssessmentsSchemaError(
      `${label}.level must be one of ${SKILL_LEVELS.join(", ")} (got "${raw.level}")`,
    );
  }
  assertNumber(raw.confidence, `${label}.confidence`);
  if (raw.confidence < 0 || raw.confidence > 1) {
    throw new AssessmentsSchemaError(`${label}.confidence must be between 0.0 and 1.0`);
  }
  assertString(raw.rationale, `${label}.rationale`);
  if (!Array.isArray(raw.evidence) || raw.evidence.length === 0) {
    throw new AssessmentsSchemaError(`${label}.evidence must be a non-empty array`);
  }
  const evidence = raw.evidence.map((item, i) =>
    validateEvidenceItem(item, `${label}.evidence[${i}]`),
  );
  const assessment: Assessment = {
    id: raw.id,
    developer_id: raw.developer_id,
    category_id: raw.category_id,
    level: raw.level,
    confidence: raw.confidence,
    rationale: raw.rationale,
    evidence,
  };
  if (raw.study !== undefined) {
    assessment.study = validateStudy(raw.study, `${label}.study`);
  }
  return assessment;
}

/** Validates a parsed assessments document. Throws AssessmentsSchemaError on failure. */
export function validateAssessmentsFile(raw: unknown): AssessmentsFile {
  assertObject(raw, "root");
  assertString(raw.taxonomy_version, "taxonomy_version");
  assertString(raw.organization_id, "organization_id");
  assertString(raw.computed_at, "computed_at");
  if (Number.isNaN(Date.parse(raw.computed_at))) {
    throw new AssessmentsSchemaError("computed_at must be a valid ISO timestamp");
  }
  assertString(raw.config_hash, "config_hash");
  if (!Array.isArray(raw.assessments) || raw.assessments.length === 0) {
    throw new AssessmentsSchemaError("assessments must be a non-empty array");
  }

  const assessments = raw.assessments.map((item, i) => validateAssessment(item, i));

  const seen = new Set<string>();
  for (const assessment of assessments) {
    const key = `${assessment.developer_id}::${assessment.category_id}`;
    if (seen.has(key)) {
      throw new AssessmentsSchemaError(`duplicate assessment for ${key}`);
    }
    seen.add(key);
  }

  return {
    taxonomy_version: raw.taxonomy_version,
    organization_id: raw.organization_id,
    computed_at: raw.computed_at,
    config_hash: raw.config_hash,
    assessments,
  };
}

/** Loads and validates data/assessments.json. Fails loudly on any schema violation. */
export function loadAssessments(): AssessmentsFile {
  return validateAssessmentsFile(rawAssessments);
}

const assessmentsFile: AssessmentsFile = loadAssessments();

export function getAssessments(): AssessmentsFile {
  return assessmentsFile;
}

/** Assessments that carry study-script metadata (used for Task 2 suggestion control). */
export function getScriptedAssessments(): Assessment[] {
  return getAssessments().assessments.filter((a) => a.study != null);
}
