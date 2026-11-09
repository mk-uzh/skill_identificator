"use client";

import type { Developer } from "@/lib/types";

/** Who is being rated. Sits beside the work. Background information is behind the "i" next to the work. */
export function PersonLine({ developer }: { developer: Developer }) {
  return (
    <aside className="side" aria-label={`About ${developer.label}`}>
      <div className="side__head">
        <b>{developer.label}</b>
        <p>{developer.profile}</p>
      </div>
    </aside>
  );
}
