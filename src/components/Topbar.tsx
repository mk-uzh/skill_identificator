"use client";

import Link from "next/link";
import { useVisibility } from "@/lib/visibility-context";
import type { VisibilityMode } from "@/lib/org-config";

export function Topbar() {
  const { visibility, setVisibility, labels } = useVisibility();

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__left">
          <Link href="/" className="topbar__brand">
            DevSkill
          </Link>
          <span className="topbar__meta">Team Skill Matrix Study · University of Zurich</span>
        </div>
        <div className="topbar__right">
          <label className="topbar__settings">
            <span className="topbar__settings-label">Visibility</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as VisibilityMode)}
              aria-label="Visibility setting"
            >
              {(Object.keys(labels) as VisibilityMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {labels[mode]}
                </option>
              ))}
            </select>
          </label>
          <Link href="/developer" className="topbar__link">
            Developer login
          </Link>
        </div>
      </div>
    </header>
  );
}
