"use client";

import { LEVEL_ANCHORS_SHORT } from "@/lib/taxonomy";
import {
  ORDERED_LEVELS,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_SHORT,
  type SkillLevel,
} from "@/lib/types";

/**
 * Five level tiles and an n/o tile in a row; the meaning of the chosen level is written below, so
 * the scale never has to be looked up elsewhere (DP2).
 *
 * "Not observable" is set apart on purpose: it is not a sixth, lower level
 * but the statement that the records say nothing (DP7).
 */
export function RatingPanel({
  name,
  value,
  onChange,
}: {
  name: string;
  value: SkillLevel | null;
  onChange: (level: SkillLevel) => void;
}) {
  const na = value === "not_observable";
  return (
    <div>
      <div role="radiogroup" aria-label={`Level for ${name}`} className="scale">
        {ORDERED_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={value === level}
            className="lvtile"
            onClick={() => onChange(level)}
          >
            <b>{SKILL_LEVEL_SHORT[level]}</b>
            <small>{SKILL_LEVEL_LABELS[level]}</small>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={na}
          className="lvtile lvtile--na"
          onClick={() => onChange("not_observable")}
          title="The records show nothing about this"
        >
          <b>n/o</b>
          <small>Nothing in the records</small>
        </button>
      </div>
      <div className="meaning" aria-live="polite">
        {value ? (
          <>
            <b>{SKILL_LEVEL_LABELS[value]}.</b>{" "}
            {na
              ? "The records show nothing about this. That is information, not a gap in your judgement."
              : LEVEL_ANCHORS_SHORT[value] + "."}
          </>
        ) : (
          <>
            Pick the level the records support. Keys <kbd>1</kbd> to <kbd>5</kbd> work too.
          </>
        )}
      </div>
    </div>
  );
}
