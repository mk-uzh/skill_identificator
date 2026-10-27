"use client";

import { LevelButtons } from "@/components/LevelButtons";
import { groupedCategories } from "@/lib/taxonomy";
import type { Matrix, SkillLevel } from "@/lib/types";

/**
 * The competences of one person, grouped, each with its level buttons.
 *
 * Selecting a row shows that competence's records in the panel beside it, so
 * a rating is always made against named evidence rather than an impression of
 * the person as a whole (DP1).
 */
export function CompetenceList({
  devId,
  matrix,
  selected,
  onSelect,
  onChange,
  onOpen,
}: {
  devId: string;
  matrix: Matrix;
  selected: string | null;
  onSelect: (categoryId: string) => void;
  onChange: (categoryId: string, level: SkillLevel) => void;
  onOpen?: (categoryId: string) => void;
}) {
  return (
    <div className="complist">
      {groupedCategories().map(({ group, items }) => (
        <div key={group.id}>
          <div className="complist__group">{group.label}</div>
          {items.map((category) => {
            const value = matrix[devId]?.[category.id] ?? null;
            return (
              <div
                key={category.id}
                className={
                  "complist__row" + (selected === category.id ? " complist__row--sel" : "")
                }
                onClick={() => onSelect(category.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(category.id);
                  }
                }}
              >
                <div className="complist__name">
                  <b>{category.label}</b>
                  <div className="small muted">{category.plain}</div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <LevelButtons
                    name={category.label}
                    value={value}
                    onOpen={() => onOpen?.(category.id)}
                    onChange={(level) => {
                      onSelect(category.id);
                      onChange(category.id, level);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
