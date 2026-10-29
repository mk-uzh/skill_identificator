"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      </div>
    </header>
  );
}
