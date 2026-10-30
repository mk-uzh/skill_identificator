"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PROJECTS, parseProject } from "@/lib/project";
import { useProject } from "@/lib/project-context";

const PHASES: { label: string; paths: string[] }[] = [
  { label: "Start", paths: ["/"] },
  { label: "Task 1", paths: ["/task1"] },
  { label: "Overview", paths: ["/overview"] },
  { label: "Task 2", paths: ["/task2"] },
  { label: "Summary", paths: ["/summary"] },
  { label: "Questions", paths: ["/done"] },
];

export function Topbar() {
  const path = usePathname() ?? "/";
  const current = PHASES.findIndex((p) => p.paths.includes(path));
  const inStudy = current >= 0;
  const { project, setProject } = useProject();

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link href="/" className="brand">
          <i aria-hidden="true" />
          DevSkill
        </Link>
        {inStudy && (
          <ol className="phases" aria-label="Study steps">
            {PHASES.map((p, i) => (
              <li
                key={p.label}
                className={i === current ? "cur" : i < current ? "done" : ""}
                aria-current={i === current ? "step" : undefined}
              >
                {p.label}
              </li>
            ))}
          </ol>
        )}
        <label className="projsel">
          <span>Project</span>
          <select
            value={project}
            onChange={(e) => setProject(parseProject(e.target.value))}
            aria-label="Project the case study is run on"
          >
            {PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
