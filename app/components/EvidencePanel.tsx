"use client";

import { getAssessment, type EvidenceItem } from "@/lib/assessments";
import { CATEGORIES } from "@/lib/taxonomy";

const KIND_LABEL: Record<string, string> = {
  commit: "Commit",
  pull_request: "Proposal",
  review: "Review",
  issue: "Task",
};

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
}: {
  devId: string;
  categoryId: string | null;
  onEvidenceOpen?: (url: string) => void;
  /** Kept for the old call sites; the heading is now always the screen title. */
  showHeader?: boolean;
}) {
  if (!categoryId) return null;
  const category = CATEGORIES.find((c) => c.id === categoryId);
  const assessment = getAssessment(devId, categoryId);
  if (!category || !assessment) {
    return <p className="small muted">No records for this competence.</p>;
  }

  return (
    <div>
      <p className="sum">{assessment.rationale}</p>
      <ul className="ev">
        {assessment.evidence.map((item: EvidenceItem) => (
          <li key={item.url}>
            <span className={"tag tag--" + item.kind}>{KIND_LABEL[item.kind] ?? item.kind}</span>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => onEvidenceOpen?.(item.url)}
            >
              {item.title}
            </a>
            <time dateTime={item.timestamp}>
              {new Date(item.timestamp).toLocaleDateString("en-GB", {
                month: "short",
                year: "numeric",
              })}
            </time>
          </li>
        ))}
      </ul>
      {assessment.blind_spots && (
        <p className="blind">Not visible here: {assessment.blind_spots}.</p>
      )}
    </div>
  );
}
