"use client";

import { LEVEL_ANCHORS, LEVEL_ANCHORS_SHORT } from "@/lib/taxonomy";
import {
  ORDERED_LEVELS,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_SHORT,
} from "@/lib/types";

/**
 * DP2 — the anchors that make a level mean the same thing to every rater.
 *
 * `compact` is for the column beside the rating, where the full anchors would
 * make the guide taller than the thing it explains. The long form stays on the
 * introduction, where it is read once and carefully.
 */
export function LevelGuide({
  open = true,
  compact = false,
  bare = false,
}: {
  open?: boolean;
  compact?: boolean;
  /** Only the table, for use inside another collapsible. */
  bare?: boolean;
}) {
  const anchors = compact ? LEVEL_ANCHORS_SHORT : LEVEL_ANCHORS;
  const table = (
        <table className="lvtab">
          <tbody>
            {[...ORDERED_LEVELS, "not_observable" as const].map((level) => (
              <tr key={level}>
                <td>
                  <span
                    className={
                      "lv lv--static " +
                      (level === "not_observable" ? "lv--na" : `lv--${level}`)
                    }
                  >
                    {SKILL_LEVEL_SHORT[level]}
                  </span>
                </td>
                <td>
                  {compact ? (
                    anchors[level]
                  ) : (
                    <>
                      <b>{SKILL_LEVEL_LABELS[level]}</b>
                      <div className="small muted">{anchors[level]}</div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
  );
  if (bare) return table;
  return (
    <details className="guide" open={open}>
      <summary>Level guide</summary>
      <div className="guide__body">{table}</div>
    </details>
  );
}

/**
 * What the confidence figure means.
 *
 * The bands are a declared reading of the number, not a property of it. As
 * long as no model produces the value, this guide is what gives it meaning —
 * and it says plainly that it is about the records, not about the person.
 */
export function ConfidenceGuide({ open = false }: { open?: boolean }) {
  return (
    <details className="guide" open={open}>
      <summary>What confidence means</summary>
      <div className="guide__body">
        <table className="lvtab">
          <tbody>
            <tr>
              <td className="nowrap">
                <span className="dot dot--hi" /> 80–100 %
              </td>
              <td>Several records point the same way, and none point against it</td>
            </tr>
            <tr>
              <td className="nowrap">
                <span className="dot dot--mid" /> 60–79 %
              </td>
              <td>The records point one way, but there are few of them</td>
            </tr>
            <tr>
              <td className="nowrap">
                <span className="dot dot--low" /> under 60 %
              </td>
              <td>Thin or conflicting evidence. Read it as a question, not a suggestion</td>
            </tr>
          </tbody>
        </table>
        <p className="small muted" style={{ marginBottom: 0 }}>
          The figure says how certain the system is about its own reading of the records. It says
          nothing about how good the person is.
        </p>
      </div>
    </details>
  );
}
