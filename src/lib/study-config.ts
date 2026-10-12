// ---------------------------------------------------------------------------
// Study configuration
//
// All content-level knobs of the case study live here: developer profiles,
// competence categories and the parameters of the AI suggestions. The rest of
// the code does not need to be touched.
// ---------------------------------------------------------------------------

import { getScriptedAssessments, type EvidenceItem } from "./assessments";
import type { Category, Developer, SkillLevel } from "./types";

export const STUDY_TITLE = "DevSkill – Team Skill Matrix Study";

export const CATEGORIES: Category[] = [
  { id: "backend", label: "Backend", description: "Server-side development, APIs, domain logic" },
  { id: "frontend", label: "Frontend", description: "UI development, components, accessibility" },
  { id: "devops", label: "DevOps", description: "CI/CD, infrastructure as code, deployment" },
  { id: "testing", label: "Testing", description: "Unit, integration and end-to-end tests" },
  { id: "data", label: "Data", description: "Data modelling, SQL, data pipelines" },
  { id: "security", label: "Security", description: "Secure development, reviews, vulnerability analysis" },
];

export const DEVELOPERS: Developer[] = [
  {
    id: "devA",
    label: "Dev A",
    role: "Senior Software Engineer",
    tenure: "6 years with the company",
    profile:
      "Works mainly on the deployment pipeline and the container platform. Maintains the team's release automation.",
    evidence: [
      "142 commits in infra/ (last 12 months)",
      "Owner of the GitLab CI configuration",
      "Ran the internal training \u201cKubernetes Basics\u201d",
      "Occasional contributions to service-api/",
    ],
  },
  {
    id: "devB",
    label: "Dev B",
    role: "Software Engineer",
    tenure: "3 years with the company",
    profile:
      "Focuses on security reviews and access concepts. Regularly takes part in threat modelling workshops.",
    evidence: [
      "Runs security reviews for two teams",
      "OWASP certification 2024",
      "38 commits in auth-service/",
      "No contributions to the frontend repository",
    ],
  },
  {
    id: "devC",
    label: "Dev C",
    role: "Data Engineer",
    tenure: "4 years with the company",
    profile:
      "Builds and maintains the team's data pipelines. Point of contact for the data warehouse and reporting.",
    evidence: [
      "Owner of etl-pipelines/",
      "Creates the weekly reporting jobs",
      "Sporadic test coverage in own modules",
      "Occasionally works on backend tickets",
    ],
  },
  {
    id: "devD",
    label: "Dev D",
    role: "Tech Lead",
    tenure: "8 years with the company",
    profile:
      "Leads the technical architecture of the core product. Works broadly across several repositories.",
    evidence: [
      "Architecture decisions for service-api/ and web-client/",
      "Reviews roughly 40% of all merge requests",
      "Few own commits in data repositories",
      "Led the migration to the new cloud environment",
    ],
  },
  {
    id: "devE",
    label: "Dev E",
    role: "Frontend Engineer",
    tenure: "2 years with the company",
    profile:
      "Develops the team's component library and maintains the design system.",
    evidence: [
      "Owner of ui-components/",
      "Implemented the accessibility audit",
      "First contributions to data visualisations",
      "No commits in infra/",
    ],
  },
  {
    id: "devF",
    label: "Dev F",
    role: "Software Engineer (Junior)",
    tenure: "1 year with the company",
    profile:
      "New to the team, works primarily on bugfixes and test coverage. Currently rotating between two modules.",
    evidence: [
      "68 commits, mostly in tests/",
      "Extended the E2E test suite",
      "Implemented first frontend features",
      "No deployment responsibility yet",
    ],
  },
];

// ---------------------------------------------------------------------------
// AI suggestions
//
// Controllable study script lives in data/assessments.json (fields study.*,
// plus confidence / rationale / evidence). Loaded and schema-validated on
// module load — malformed files fail loudly.
// ---------------------------------------------------------------------------

export interface ScriptedSuggestion {
  devId: string;
  categoryId: string;
  direction: "raise" | "lower";
  /** By how many levels the suggestion deviates from the input. */
  delta: number;
  confidence: number;
  rationale: string;
  evidence: EvidenceItem[];
  /** Absolute inferred level from the assessments contract (M1). */
  level: SkillLevel;
  veracity: "correct" | "incorrect";
}

function loadScriptedSuggestions(): ScriptedSuggestion[] {
  return getScriptedAssessments().map((assessment) => {
    const study = assessment.study;
    if (!study) {
      throw new Error(
        `[study-config] assessment ${assessment.id} is missing study metadata`,
      );
    }
    return {
      devId: assessment.developer_id,
      categoryId: assessment.category_id,
      direction: study.direction,
      delta: study.delta,
      confidence: assessment.confidence,
      rationale: assessment.rationale,
      evidence: assessment.evidence,
      level: assessment.level,
      veracity: study.veracity,
    };
  });
}

/** Lazily validated against data/assessments.json. */
export const SCRIPTED_SUGGESTIONS: ScriptedSuggestion[] = loadScriptedSuggestions();

/**
 * If a cell is left empty in task 1, this value is used as the starting point
 * for computing the suggestion.
 */
export const FALLBACK_BASELINE: SkillLevel = "basic";

/** Controls whether confidence values and rationales are shown. */
export const SHOW_CONFIDENCE = true;
export const SHOW_RATIONALE = true;
