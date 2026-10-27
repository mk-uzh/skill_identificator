"use client";

import { CATEGORIES } from "@/lib/study-config";
import {
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_VALUE,
  type Matrix,
  type SkillLevel,
} from "@/lib/types";

/**
 * Radar scale: 1..5 are the five levels.
 *
 * "not observable" and an unrated cell both sit at the centre, because there
 * is no honest radius for them. The shape therefore understates a person
 * wherever the records are silent — which is the point of DP7 and is stated
 * under the chart rather than smoothed away.
 */
const MAX_LEVEL = 5;
const RING_LABELS = ["1", "2", "3", "4", "5"];

function levelValue(level: SkillLevel | null | undefined): number {
  if (!level) return 0;
  return SKILL_LEVEL_VALUE[level] ?? 0;
}

function polar(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.sin(angleRad),
    y: cy - radius * Math.cos(angleRad),
  };
}

function seriesGeometry(
  values: number[],
  cx: number,
  cy: number,
  maxR: number,
): { points: string; dots: Array<{ x: number; y: number }> } {
  const n = values.length;
  const dots = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / n;
    const r = (Math.max(0, Math.min(MAX_LEVEL, v)) / MAX_LEVEL) * maxR;
    return polar(cx, cy, r, angle);
  });
  return {
    points: dots.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
    dots,
  };
}

export function SkillRadar({
  task1,
  task2,
  developerId,
  show = "both",
  withTable = true,
}: {
  task1: Matrix;
  task2: Matrix;
  developerId: string;
  /** Which series to draw. */
  show?: "both" | "before" | "after";
  /** The summary carries its own table; off by default there. */
  withTable?: boolean;
}) {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 140;
  /** Room on both sides for the competence names. */
  const margin = 150;
  const n = CATEGORIES.length;

  const row1 = task1[developerId] ?? {};
  const row2 = task2[developerId] ?? {};

  // Every competence must show a level: fall back to the own rating if the
  // final one is empty.
  const levels1 = CATEGORIES.map((c) => (row1[c.id] ?? null) as SkillLevel | null);
  const levels2 = CATEGORIES.map(
    (c) => (row2[c.id] ?? row1[c.id] ?? null) as SkillLevel | null,
  );
  const values1 = levels1.map(levelValue);
  const values2 = levels2.map(levelValue);

  const geo1 = seriesGeometry(values1, cx, cy, maxR);
  const geo2 = seriesGeometry(values2, cx, cy, maxR);

  const rings = [1, 2, 3, 4, 5].map((level) => {
    const r = (level / MAX_LEVEL) * maxR;
    const pts = Array.from({ length: n }, (_, i) => {
      const p = polar(cx, cy, r, (Math.PI * 2 * i) / n);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");
    return <polygon key={level} points={pts} className="radar__ring" />;
  });

  const axes = CATEGORIES.map((category, i) => {
    const angle = (Math.PI * 2 * i) / n;
    const end = polar(cx, cy, maxR, angle);
    const labelPos = polar(cx, cy, maxR + 26, angle);
    // Anchor by side, otherwise a long competence name on the left runs out
    // of the drawing and is cut off.
    const anchor =
      labelPos.x < cx - 4 ? "end" : labelPos.x > cx + 4 ? "start" : "middle";
    return (
      <g key={category.id}>
        <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="radar__axis" />
        <text
          x={labelPos.x}
          y={labelPos.y}
          textAnchor={anchor}
          dominantBaseline="middle"
          className="radar__label"
        >
          {category.label}
        </text>
      </g>
    );
  });

  const ticks = RING_LABELS.map((label, index) => {
    const level = index + 1;
    const p = polar(cx, cy, (level / MAX_LEVEL) * maxR, 0);
    return (
      <text key={label} x={p.x + 6} y={p.y + 3} className="radar__tick">
        {label}
      </text>
    );
  });

  return (
    <div className="radar-wrap">
      <svg
        className="radar"
        viewBox={`${-margin} 0 ${size + margin * 2} ${size}`}
        role="img"
        aria-label="Skill radar comparing the own assessment with the final one"
      >
        {rings}
        {axes}
        {ticks}
        {show !== "after" && (
          <polygon points={geo1.points} className="radar__series radar__series--task1" />
        )}
        {show !== "before" && (
          <polygon points={geo2.points} className="radar__series radar__series--task2" />
        )}
        {(show === "after" ? [] : geo1.dots).map((p, i) =>
          values1[i] > 0 ? (
            <circle
              key={`t1-${CATEGORIES[i].id}`}
              cx={p.x}
              cy={p.y}
              r={4}
              className="radar__dot radar__dot--task1"
            />
          ) : null,
        )}
        {(show === "before" ? [] : geo2.dots).map((p, i) =>
          values2[i] > 0 ? (
            <circle
              key={`t2-${CATEGORIES[i].id}`}
              cx={p.x}
              cy={p.y}
              r={4}
              className="radar__dot radar__dot--task2"
            />
          ) : null,
        )}
      </svg>

      <div className="radar-legend">
        <span className="radar-legend__item radar-legend__item--task1">Task 1</span>
        <span className="radar-legend__item radar-legend__item--task2">Task 2</span>
      </div>

      {withTable && (<table className="radar-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Task 1</th>
            <th>Task 2</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((category, i) => (
            <tr key={category.id}>
              <td>{category.label}</td>
              <td>{levels1[i] ? SKILL_LEVEL_LABELS[levels1[i]!] : "none"}</td>
              <td>{levels2[i] ? SKILL_LEVEL_LABELS[levels2[i]!] : "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>)}
    </div>
  );
}
