import { SKILL_LEVELS, SKILL_LEVEL_LABELS } from "@/lib/types";

export function Legend() {
  return (
    <div className="legend">
      {SKILL_LEVELS.map((level) => (
        <span className="legend__item" key={level}>
          <span className={`legend__swatch cell--${level}`} />
          {SKILL_LEVEL_LABELS[level]}
        </span>
      ))}
    </div>
  );
}
