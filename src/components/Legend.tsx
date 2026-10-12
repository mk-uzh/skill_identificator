import { ORG_CONFIG } from "@/lib/org-config";
import { SKILL_LEVELS, SKILL_LEVEL_LABELS } from "@/lib/types";

export function Legend() {
  return (
    <div className="legend">
      {SKILL_LEVELS.map((level) => (
        <span
          className="legend__item"
          key={level}
          title={ORG_CONFIG.level_anchors[level]}
        >
          <span className={`legend__swatch cell--${level}`} />
          {SKILL_LEVEL_LABELS[level]}
          <span className="legend__anchor muted">
            — {ORG_CONFIG.level_anchors[level]}
          </span>
        </span>
      ))}
    </div>
  );
}
