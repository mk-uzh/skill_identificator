// ---------------------------------------------------------------------------
// Projects the case study can be run on.
//
// Both projects use the same study script (same people slots, same levels,
// same deliberately wrong cells), so results stay comparable. Only the
// wording of the people and of the system's reasons differs.
// ---------------------------------------------------------------------------

export const PROJECTS = [
  { id: "sakai", label: "Sakai", full: "Sakai, an open-source learning platform" },
  { id: "nifi", label: "Apache NiFi", full: "Apache NiFi, an open-source data-flow tool" },
] as const;

export type ProjectId = (typeof PROJECTS)[number]["id"];

export const DEFAULT_PROJECT: ProjectId = "sakai";

export function parseProject(raw: unknown): ProjectId {
  return PROJECTS.some((p) => p.id === raw) ? (raw as ProjectId) : DEFAULT_PROJECT;
}

export function projectInfo(id: ProjectId) {
  return PROJECTS.find((p) => p.id === id) ?? PROJECTS[0];
}
