"use client";

import { CATEGORIES } from "@/lib/study-config";
import {
  SKILL_LEVEL_LABELS,
  type Matrix,
  type SkillLevel,
} from "@/lib/types";

/**
 * Radar scale: missing/rejected stay at the centre (0).
 * Explicit "none" sits on the first ring so it is visible — unlike raw 0..3 mapping.
 */
const RADAR_VALUE: Record<SkillLevel, number> = {
  none: 1,
  basic: 2,
  proficient: 3,
  expert: 4,
};
const MAX_LEVEL = 4;
const RING_LABELS = ["none", "basic", "proficient", "expert"];

function levelValue(level: SkillLevel | null | undefined): number {
  if (!level) return 0;
  return RADAR_VALUE[level];
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
}: {
  task1: Matrix;
  task2: Matrix;
  developerId: string;
}) {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 140;
  const n = CATEGORIES.length;

  const row1 = task1[developerId] ?? {};
  const row2 = task2[developerId] ?? {};

  // Every category must show a level: fall back to Task 1 if Task 2 is empty.
  const levels1 = CATEGORIES.map((c) => (row1[c.id] ?? null) as SkillLevel | null);
  const levels2 = CATEGORIES.map(
    (c) => (row2[c.id] ?? row1[c.id] ?? null) as SkillLevel | null,
  );
  const values1 = levels1.map(levelValue);
  const values2 = levels2.map(levelValue);

  const geo1 = seriesGeometry(values1, cx, cy, maxR);
  const geo2 = seriesGeometry(values2, cx, cy, maxR);

  const rings = [1, 2, 3, 4].map((level) => {
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
    const labelPos = polar(cx, cy, maxR + 28, angle);
    return (
      <g key={category.id}>
        <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="radar__axis" />
        <text
          x={labelPos.x}
          y={labelPos.y}
          textAnchor="middle"
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
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Skill radar comparing Task 1 and Task 2"
      >
        {rings}
        {axes}
        {ticks}
        <polygon points={geo1.points} className="radar__series radar__series--task1" />
        <polygon points={geo2.points} className="radar__series radar__series--task2" />
        {geo1.dots.map((p, i) =>
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
        {geo2.dots.map((p, i) =>
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

      <table className="radar-table">
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
      </table>
    </div>
  );
}
