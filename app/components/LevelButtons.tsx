"use client";

import {
  ORDERED_LEVELS,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_SHORT,
  type SkillLevel,
} from "@/lib/types";

/**
 * The 1..5 buttons plus "not observable".
 *
 * "n/o" is set apart visually on purpose: it is not a sixth, lower level but
 * the statement that the records say nothing (DP7).
 */
export function LevelButtons({
  value,
  onChange,
  onOpen,
  disabled,
  name,
}: {
  value: SkillLevel | null;
  onChange: (level: SkillLevel) => void;
  onOpen?: () => void;
  disabled?: boolean;
  /** Accessible group label, e.g. the competence name. */
  name: string;
}) {
  return (
    <span className="lvgroup" role="radiogroup" aria-label={`Level for ${name}`}>
      {ORDERED_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          aria-label={`${SKILL_LEVEL_SHORT[level]} – ${SKILL_LEVEL_LABELS[level]}`}
          title={SKILL_LEVEL_LABELS[level]}
          disabled={disabled}
          className={`lv lv--${level}` + (value === level ? " lv--on" : "")}
          onClick={() => {
            onOpen?.();
            onChange(level);
          }}
        >
          {SKILL_LEVEL_SHORT[level]}
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={value === "not_observable"}
        aria-label="Not observable – the records show nothing about this"
        title="The records show nothing about this competence"
        disabled={disabled}
        className={"lv lv--na" + (value === "not_observable" ? " lv--on" : "")}
        onClick={() => {
          onOpen?.();
          onChange("not_observable");
        }}
      >
        {SKILL_LEVEL_SHORT.not_observable}
      </button>
    </span>
  );
}
