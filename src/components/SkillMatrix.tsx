"use client";

import { CATEGORIES, DEVELOPERS } from "@/lib/study-config";
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
  mode?: "task1" | "task2";
  /** Limit rows (developer self-view). */
  developerFilter?: string[];
  suggestions?: Map<string, AiSuggestion>;
  task1Matrix?: Matrix;
  decisions?: Record<string, SuggestionDecision>;
  onAccept?: (suggestion: AiSuggestion) => void;
  onReject?: (suggestion: AiSuggestion) => void;
  openEvidence?: string | null;
  onToggleEvidence?: (suggestion: AiSuggestion) => void;
  /** Expanded compact (non-diff) cells. */
  expandedCells?: Record<string, boolean>;
  onToggleExpand?: (devId: string, categoryId: string) => void;
  correctionNotes?: Record<string, string>;
  onCorrectionNoteChange?: (devId: string, categoryId: string, note: string) => void;
}

export function SkillMatrix({
  matrix,
  onCellChange,
  onCellOpen,
  onProfileOpen,
  mode = "task1",
  developerFilter,
  suggestions,
  task1Matrix,
  decisions,
  onAccept,
  onReject,
  openEvidence,
  onToggleEvidence,
  expandedCells,
  onToggleExpand,
  correctionNotes,
  onCorrectionNoteChange,
}: SkillMatrixProps) {
  const isTask2 = mode === "task2";
  const rows = developerFilter
    ? DEVELOPERS.filter((d) => developerFilter.includes(d.id))
    : DEVELOPERS;

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
          {rows.map((developer) => (
            <tr key={developer.id}>
              <td className="matrix__rowhead">
                <button
                  type="button"
                  className="devbtn"
                  onClick={() => onProfileOpen?.(developer.id)}
                  title="Show profile"
                >
                  {developer.label}
                  <span className="devbtn__role">{developer.role}</span>
                </button>
              </td>

              {CATEGORIES.map((category, columnIndex) => {
                const value = matrix[developer.id]?.[category.id] ?? null;
                const alignPopoverRight = columnIndex >= CATEGORIES.length - 2;
                const key = suggestionKey(developer.id, category.id);
                const suggestion = isTask2 ? suggestions?.get(key) : undefined;
                const decision = decisions?.[key] ?? "open";
                const task1Value = task1Matrix?.[developer.id]?.[category.id] ?? null;
                const differs = Boolean(
                  suggestion && task1Value != null && task1Value !== suggestion.suggested,
                );
                const expanded = Boolean(expandedCells?.[key]);

                const cellClass = [
                  "cell",
                  value ? `cell--${value}` : "cell--empty",
                  suggestion && decision === "open" && differs ? "cell--suggested" : "",
                  differs ? "cell--differs" : "",
                  !differs && isTask2 ? "cell--same" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <td key={category.id}>
                    <div className={cellClass}>
                      {!isTask2 && (
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
                      )}

                      {isTask2 && suggestion && differs && (
                        <DiffCell
                          task1Value={task1Value}
                          suggestion={suggestion}
                          decision={decision}
                          alignPopoverRight={alignPopoverRight}
                          openEvidence={openEvidence === key}
                          correctionNote={correctionNotes?.[key] ?? ""}
                          onAccept={() => onAccept?.(suggestion)}
                          onReject={() => onReject?.(suggestion)}
                          onToggleEvidence={() => onToggleEvidence?.(suggestion)}
                          onCorrectionNoteChange={(note) =>
                            onCorrectionNoteChange?.(developer.id, category.id, note)
                          }
                        />
                      )}

                      {isTask2 && suggestion && !differs && (
                        <SameCell
                          developerLabel={developer.label}
                          categoryLabel={category.label}
                          value={value}
                          suggestion={suggestion}
                          expanded={expanded}
                          alignPopoverRight={alignPopoverRight}
                          openEvidence={openEvidence === key}
                          correctionNote={correctionNotes?.[key] ?? ""}
                          onToggleExpand={() =>
                            onToggleExpand?.(developer.id, category.id)
                          }
                          onCellOpen={() => onCellOpen?.(developer.id, category.id)}
                          onCellChange={(next) =>
                            onCellChange(developer.id, category.id, next)
                          }
                          onToggleEvidence={() => onToggleEvidence?.(suggestion)}
                          onCorrectionNoteChange={(note) =>
                            onCorrectionNoteChange?.(developer.id, category.id, note)
                          }
                        />
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

function DiffCell({
  task1Value,
  suggestion,
  decision,
  alignPopoverRight,
  openEvidence,
  correctionNote,
  onAccept,
  onReject,
  onToggleEvidence,
  onCorrectionNoteChange,
}: {
  task1Value: SkillLevel | null;
  suggestion: AiSuggestion;
  decision: SuggestionDecision;
  alignPopoverRight: boolean;
  openEvidence: boolean;
  correctionNote: string;
  onAccept: () => void;
  onReject: () => void;
  onToggleEvidence: () => void;
  onCorrectionNoteChange: (note: string) => void;
}) {
  const you = task1Value ? SKILL_LEVEL_LABELS[task1Value] : "—";
  const system = SKILL_LEVEL_LABELS[suggestion.suggested];
  const conf = Math.round(suggestion.confidence * 100);

  return (
    <div className="diff-cell">
      <div className="diff-cell__top">
        <div className="diff-compare" title="You (Task 1) → system suggestion">
          <strong>{you}</strong>
          <span className="diff-compare__arrow" aria-hidden="true">
            →
          </span>
          <strong className="diff-compare__to">{system}</strong>
          <span className="cell-meta__conf">{conf}%</span>
        </div>
        <InfoIcon
          suggestion={suggestion}
          open={openEvidence}
          alignRight={alignPopoverRight}
          correctionNote={correctionNote}
          onToggle={onToggleEvidence}
          onCorrectionNoteChange={onCorrectionNoteChange}
        />
      </div>

      {decision === "accepted_unchanged" && (
        <div className="badge-resolved">Accepted: {system}</div>
      )}
      {decision === "rejected" && (
        <div className="badge-resolved">Kept Task 1: {you}</div>
      )}
      {decision === "adjusted" && <div className="badge-resolved">Changed</div>}

      {decision === "open" && (
        <div className="suggestion__actions suggestion__actions--row">
          <button type="button" className="chip chip--primary" onClick={onAccept}>
            Accept
          </button>
          <button type="button" className="chip" onClick={onReject}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function SameCell({
  developerLabel,
  categoryLabel,
  value,
  suggestion,
  expanded,
  alignPopoverRight,
  openEvidence,
  correctionNote,
  onToggleExpand,
  onCellOpen,
  onCellChange,
  onToggleEvidence,
  onCorrectionNoteChange,
}: {
  developerLabel: string;
  categoryLabel: string;
  value: SkillLevel | null;
  suggestion: AiSuggestion;
  expanded: boolean;
  alignPopoverRight: boolean;
  openEvidence: boolean;
  correctionNote: string;
  onToggleExpand: () => void;
  onCellOpen: () => void;
  onCellChange: (next: SkillLevel | null) => void;
  onToggleEvidence: () => void;
  onCorrectionNoteChange: (note: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="same-cell-btn"
        onClick={onToggleExpand}
        title="Same as your Task 1 — click to edit, comment or open evidence"
      >
        <span>{value ? SKILL_LEVEL_LABELS[value] : "—"}</span>
        <span className="same-cell-btn__hint">
          match · {Math.round(suggestion.confidence * 100)}%
        </span>
      </button>

      {expanded && (
        <div className="same-cell-panel">
          <select
            value={value ?? ""}
            aria-label={`${developerLabel}, ${categoryLabel}`}
            onFocus={onCellOpen}
            onChange={(e) =>
              onCellChange(e.target.value === "" ? null : (e.target.value as SkillLevel))
            }
          >
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {SKILL_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
          <div className="same-cell-panel__info">
            <InfoIcon
              suggestion={suggestion}
              open={openEvidence}
              alignRight={alignPopoverRight}
              correctionNote={correctionNote}
              onToggle={onToggleEvidence}
              onCorrectionNoteChange={onCorrectionNoteChange}
            />
          </div>
        </div>
      )}
    </>
  );
}

/** Top-right info icon: hover shows rationale; click pins full evidence. */
function InfoIcon({
  suggestion,
  open,
  alignRight,
  correctionNote,
  onToggle,
  onCorrectionNoteChange,
}: {
  suggestion: AiSuggestion;
  open: boolean;
  alignRight: boolean;
  correctionNote: string;
  onToggle: () => void;
  onCorrectionNoteChange: (note: string) => void;
}) {
  return (
    <div className={"info-tip" + (alignRight ? " info-tip--right" : "")}>
      <button
        type="button"
        className="info-tip__btn"
        aria-label="Rationale and evidence"
        aria-expanded={open}
        onClick={onToggle}
      >
        i
      </button>
      <div className={"info-tip__hover" + (open ? " info-tip__hover--pinned" : "")}>
        <p className="evidence-rationale">{suggestion.rationale}</p>
        {(suggestion.signals?.length ?? 0) > 0 && (
          <>
            <strong className="small">Signals</strong>
            <ul className="evidence-list">
              {(suggestion.signals ?? []).map((signal) => (
                <li key={signal.kind}>
                  <span className="evidence-list__kind">{signal.kind}</span> {signal.label}
                </li>
              ))}
            </ul>
          </>
        )}
        <strong className="small" style={{ display: "block", marginTop: 8 }}>
          Evidence
        </strong>
        <ul className="evidence-list">
          {suggestion.evidence.map((item) => (
            <li key={item.url}>
              <span className="evidence-list__kind">{item.kind}</span>{" "}
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
        {open && (
          <label className="correction-note">
            <span className="small">Correction note (optional)</span>
            <textarea
              rows={2}
              value={correctionNote}
              placeholder="Why this cell is wrong or incomplete…"
              onChange={(e) => onCorrectionNoteChange(e.target.value)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
