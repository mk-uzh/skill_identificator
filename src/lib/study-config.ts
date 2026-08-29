// ---------------------------------------------------------------------------
// Study configuration
//
// All content-level knobs of the case study live here: developer profiles,
// competence categories and the parameters of the AI suggestions. The rest of
// the code does not need to be touched.
// ---------------------------------------------------------------------------

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
// For an experimental study the suggestions must be controllable. They are
// therefore NOT random but defined as a fixed script: for each cell it is
// specified in which direction the system deviates and whether the suggestion
// is correct ("correct") or deliberately wrong ("incorrect") by design. This
// distinction is what makes the later analysis of automation bias possible.
//
// Order and count match the mockup (6 suggestions).
// ---------------------------------------------------------------------------

export interface ScriptedSuggestion {
  devId: string;
  categoryId: string;
  direction: "raise" | "lower";
  /** By how many levels the suggestion deviates from the input. */
  delta: number;
  confidence: number;
  rationale: string;
  veracity: "correct" | "incorrect";
}

export const SCRIPTED_SUGGESTIONS: ScriptedSuggestion[] = [
  {
    devId: "devA",
    categoryId: "backend",
    direction: "raise",
    delta: 1,
    confidence: 0.86,
    rationale: "Regular contributions to service-api/ and reviews of backend merge requests.",
    veracity: "incorrect",
  },
  {
    devId: "devB",
    categoryId: "backend",
    direction: "lower",
    delta: 1,
    confidence: 0.74,
    rationale: "Contributions concentrate on auth-service/, little breadth in domain logic.",
    veracity: "correct",
  },
  {
    devId: "devC",
    categoryId: "testing",
    direction: "raise",
    delta: 1,
    confidence: 0.68,
    rationale: "Test files in own modules were extended over the last months.",
    veracity: "incorrect",
  },
  {
    devId: "devE",
    categoryId: "data",
    direction: "lower",
    delta: 1,
    confidence: 0.81,
    rationale: "Data-related contributions are limited to visualisation components.",
    veracity: "correct",
  },
  {
    devId: "devF",
    categoryId: "devops",
    direction: "raise",
    delta: 1,
    confidence: 0.63,
    rationale: "Configuration files of the test pipeline were adjusted several times.",
    veracity: "incorrect",
  },
  {
    devId: "devD",
    categoryId: "security",
    direction: "raise",
    delta: 1,
    confidence: 0.79,
    rationale: "Reviews security-relevant merge requests in the core product.",
    veracity: "correct",
  },
];

/**
 * If a cell is left empty in task 1, this value is used as the starting point
 * for computing the suggestion.
 */
export const FALLBACK_BASELINE: SkillLevel = "basic";

/** Controls whether confidence values and rationales are shown. */
export const SHOW_CONFIDENCE = true;
export const SHOW_RATIONALE = true;
