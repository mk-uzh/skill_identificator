// ---------------------------------------------------------------------------
// Projects the case study can be run on.
//
// Both projects use the same study script (same people slots, same levels,
// same deliberately wrong cells), so results stay comparable. Only the
// wording of the people and of the system's reasons differs.
// ---------------------------------------------------------------------------

export const PROJECTS = [
  {
    id: "sakai",
    label: "Sakai",
    full: "Sakai, an open-source learning platform",
    background:
      "Sakai is an open-source learning management system. Universities and colleges use it for courses, assignments, tests and grades. It is written mostly in Java and JavaScript and developed by a community of institutions. Areas you will meet in the records include Assignments, Gradebook and Tests & Quizzes.",
  },
  {
    id: "nifi",
    label: "Apache NiFi",
    full: "Apache NiFi, an open-source data-flow tool",
    background:
      "Apache NiFi is open-source software for automating the flow of data between systems. It receives, routes, transforms and delivers data through configurable building blocks called processors. It is written mostly in Java and developed by the Apache Software Foundation community. Areas you will meet in the records include the core framework, the extensions (processors) and the build tools.",
  },
] as const;

export type ProjectId = (typeof PROJECTS)[number]["id"];

export const DEFAULT_PROJECT: ProjectId = "sakai";

export function parseProject(raw: unknown): ProjectId {
  return PROJECTS.some((p) => p.id === raw) ? (raw as ProjectId) : DEFAULT_PROJECT;
}

export function projectInfo(id: ProjectId) {
  return PROJECTS.find((p) => p.id === id) ?? PROJECTS[0];
}
