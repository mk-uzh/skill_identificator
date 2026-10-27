"use client";

import { getAssessment, type EvidenceItem } from "@/lib/assessments";
import { CATEGORIES } from "@/lib/taxonomy";

/**
 * What the records show for one developer and one competence.
 *
 * Deliberately the SAME panel in both halves of a block. In the comparison
 * step the system adds its level, its confidence and its reasoning, but the
 * underlying records do not change. Showing selected evidence only next to
 * the suggestion would measure how persuasive that selection is, not whether
 * the participant trusts the system.
 */
export function EvidencePanel({
  devId,
  categoryId,
  onEvidenceOpen,
  showHeader = true,
}: {
  devId: string;
  categoryId: string | null;
  onEvidenceOpen?: (url: string) => void;
  /** Off where the screen heading already names the competence. */
  showHeader?: boolean;
}) {
  if (!categoryId) {
    return (
      <p className="small muted">
        Select a competence on the right to read what the records show about it.
      </p>
    );
  }
  const category = CATEGORIES.find((c) => c.id === categoryId);
  const assessment = getAssessment(devId, categoryId);
  if (!category || !assessment) {
    return <p className="small muted">No records for this competence.</p>;
  }

  return (
    <div>
      {showHeader && (
        <p className="small muted" style={{ marginTop: 0 }}>
          Selected competence: <b>{category.label}</b>
        </p>
      )}
      <div className="ev">
        <p style={{ marginTop: 0 }}>{assessment.rationale}</p>
        <ul className="small">
          {assessment.evidence.map((item: EvidenceItem) => (
            <li key={item.url}>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => onEvidenceOpen?.(item.url)}
              >
                {item.title}
              </a>{" "}
              <span className="muted">
                · {item.kind.replace("_", " ")} ·{" "}
                {new Date(item.timestamp).toLocaleDateString("en-GB", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </li>
          ))}
        </ul>
        {assessment.blind_spots && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            <b>Not visible here:</b> {assessment.blind_spots}.
          </p>
        )}
      </div>
    </div>
  );
}
