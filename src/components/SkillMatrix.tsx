"use client";

import { CATEGORIES, DEVELOPERS, SHOW_CONFIDENCE, SHOW_RATIONALE } from "@/lib/study-config";
import { suggestionKey } from "@/lib/suggestions";
import {
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
  type AiSuggestion,
  type Matrix,
  type SkillLevel,
  type SuggestionDecision,
} from "@/lib/types";

export interface SkillMatrixProps {
  matrix: Matrix;
  onCellChange: (devId: string, categoryId: string, next: SkillLevel | null) => void;
  onCellOpen?: (devId: string, categoryId: string) => void;
  onProfileOpen?: (devId: string) => void;
  /** Only set in task 2. */
  suggestions?: Map<string, AiSuggestion>;
  decisions?: Record<string, SuggestionDecision>;
  onAccept?: (suggestion: AiSuggestion) => void;
  onDismiss?: (suggestion: AiSuggestion) => void;
  /** Key of the cell whose rationale is currently expanded. */
  openRationale?: string | null;
  onToggleRationale?: (suggestion: AiSuggestion) => void;
}

export function SkillMatrix({
  matrix,
  onCellChange,
  onCellOpen,
  onProfileOpen,
  suggestions,
  decisions,
  onAccept,
  onDismiss,
  openRationale,
  onToggleRationale,
}: SkillMatrixProps) {
  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th className="matrix__rowhead">
              <span className="small muted">Developer</span>
            </th>
            {CATEGORIES.map((category) => (
              <th key={category.id} scope="col" title={category.description}>
                {category.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEVELOPERS.map((developer) => (
            <tr key={developer.id}>
              <td className="matrix__rowhead">
                <button
                  type="button"
                  className="devbtn"
                  onClick={() => onProfileOpen?.(developer.id)}
                  title="Show profile and evidence"
                >
                  {developer.label}
                  <span className="devbtn__role">{developer.role}</span>
                </button>
              </td>

              {CATEGORIES.map((category, columnIndex) => {
                const value = matrix[developer.id]?.[category.id] ?? null;
                const alignPopoverRight = columnIndex >= CATEGORIES.length - 2;
                const key = suggestionKey(developer.id, category.id);
                const suggestion = suggestions?.get(key);
                const decision = decisions?.[key] ?? "open";
                const showSuggestion = Boolean(suggestion) && decision === "open";

                const cellClass = [
                  "cell",
                  value ? `cell--${value}` : "cell--empty",
                  showSuggestion ? "cell--suggested" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <td key={category.id}>
                    <div className={cellClass}>
                      <select
                        value={value ?? ""}
                        aria-label={`${developer.label}, ${category.label}`}
                        onFocus={() => onCellOpen?.(developer.id, category.id)}
                        onChange={(e) =>
                          onCellChange(
                            developer.id,
                            category.id,
                            e.target.value === "" ? null : (e.target.value as SkillLevel),
                          )
                        }
                      >
                        <option value="">select …</option>
                        {SKILL_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {SKILL_LEVEL_LABELS[level]}
                          </option>
                        ))}
                      </select>

                      {showSuggestion && suggestion && (
                        <div className="suggestion">
                          <button
                            type="button"
                            className="suggestion__head"
                            aria-expanded={openRationale === key}
                            onClick={() => onToggleRationale?.(suggestion)}
                            title={SHOW_RATIONALE ? "Show rationale" : undefined}
                          >
                            <span>
                              AI: {suggestion.direction === "raise" ? "↑" : "↓"}{" "}
                              {SKILL_LEVEL_LABELS[suggestion.suggested]}
                            </span>
                            {SHOW_CONFIDENCE && (
                              <span className="suggestion__conf">
                                {Math.round(suggestion.confidence * 100)}&nbsp;%
                              </span>
                            )}
                            {SHOW_RATIONALE && <span className="suggestion__info">ⓘ</span>}
                          </button>

                          {SHOW_RATIONALE && openRationale === key && (
                            <div
                              className={
                                "suggestion__pop" +
                                (alignPopoverRight ? " suggestion__pop--right" : "")
                              }
                            >
                              {suggestion.rationale}
                            </div>
                          )}

                          <div className="suggestion__actions">
                            <button
                              type="button"
                              className="chip chip--primary"
                              onClick={() => onAccept?.(suggestion)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="chip"
                              onClick={() => onDismiss?.(suggestion)}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}

                      {suggestion && decision !== "open" && (
                        <div className="badge-resolved">
                          {decision === "accepted"
                            ? "suggestion accepted"
                            : decision === "modified"
                              ? "own value set"
                              : "suggestion dismissed"}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
