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
      "Sakai is an open-source learning management system. Universities and colleges use it for courses, assignments, tests and grades. It is written mostly in Java and JavaScript and developed by a community of institutions.",
    features: [
      ["Courses and lessons", "Teachers put texts, files, videos and quizzes into lessons and release them under conditions they set."],
      ["Assignments and grading", "Students hand in work, teachers give feedback with rubrics and enter grades in the gradebook (areas Assignments, Gradebook, Rubrics)."],
      ["Tests & Quizzes", "Online tests with different question types, timing and automatic scoring (the code is called Samigo)."],
      ["Discussion and messaging", "Conversations between teachers and students inside a course (area Conversations)."],
      ["Administration", "Managing courses, users, roles and permissions, and connecting other tools through standard interfaces."],
    ],
  },
  {
    id: "nifi",
    label: "Apache NiFi",
    full: "Apache NiFi, an open-source data-flow tool",
    background:
      "Apache NiFi is open-source software for automating the flow of data between systems. It receives, routes, transforms and delivers data through configurable building blocks called processors. It is written mostly in Java and developed by the Apache Software Foundation community.",
    features: [
      ["Building flows in the browser", "A web interface in which people draw, change and watch data flows, even while they run (area Core UI)."],
      ["Processors", "Configurable building blocks that receive, route, transform and deliver data between systems (area Extensions)."],
      ["Tracking where data came from", "The full history of every piece of data, from its start to its delivery."],
      ["Keeping flows stable", "Priorities for data, and slowing down incoming data when later steps cannot keep up (area Core Framework)."],
      ["Security", "Encrypted connections, sign-in options and separate permissions for different user groups."],
    ],
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
