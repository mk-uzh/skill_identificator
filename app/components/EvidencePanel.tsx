"use client";

import { getAssessment, type EvidenceItem } from "@/lib/assessments";
import { useProject } from "@/lib/project-context";
import { CATEGORIES } from "@/lib/taxonomy";

/** Examples shown at once; the rest sits behind "Show more". */
const VISIBLE_EXAMPLES = 3;

const KIND_LABEL: Record<string, string> = {
  commit: "Commit",
  pull_request: "Proposal",
  review: "Review",
  issue: "Task",
};

/** "Also involved: DEV-02 (review), 2 more people (changes)". Context only, not a measure of ability. */
function involvedText(involved: EvidenceItem["involved"]): string | null {
  if (!involved || involved.length === 0) return null;
  const role = (r: string) => (r === "author" ? "changes" : "review");
  const named = involved.filter((p) => p.label).map((p) => `${p.label} (${role(p.role)})`);
  const anon = involved.filter((p) => !p.label);
  const parts = [...named];
  for (const r of ["author", "reviewer"] as const) {
    const n = anon.filter((p) => p.role === r).length;
    if (n > 0) parts.push(`${n} more ${n === 1 ? "person" : "people"} (${role(r)})`);
  }
  return `Also involved in this task: ${parts.join(", ")}`;
}

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
  const { project } = useProject();
  if (!categoryId) return null;
  const category = CATEGORIES.find((c) => c.id === categoryId);
  const assessment = getAssessment(devId, categoryId, project);
  if (!category || !assessment) {
    return <p className="small muted">No records for this competence.</p>;
  }

  const items = assessment.evidence;
  const first = items.slice(0, VISIBLE_EXAMPLES);
  const rest = items.slice(VISIBLE_EXAMPLES);
  const renderItem = (item: EvidenceItem, i: number) => (
    <li key={item.url + ":" + i}>
      <span className={"tag tag--" + item.kind}>{KIND_LABEL[item.kind] ?? item.kind}</span>
      <span className="ev__main">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onEvidenceOpen?.(item.url)}
        >
          {item.title}
        </a>
        {item.note && <span className="ev__note">{item.note}</span>}
        {involvedText(item.involved) && (
          <span className="ev__note">{involvedText(item.involved)}</span>
        )}
      </span>
      {item.timestamp ? (
        <time dateTime={item.timestamp}>
          {new Date(item.timestamp).toLocaleDateString("en-GB", {
            month: "short",
            year: "numeric",
          })}
        </time>
      ) : (
        <span />
      )}
    </li>
  );

  return (
    <div>
      <p className="sum">{assessment.rationale}</p>
      {items.length > 0 && (
        <>
          <ul className="ev">{first.map(renderItem)}</ul>
          {rest.length > 0 && (
            <details className="ev-more">
              <summary>
                Show {rest.length} more {rest.length === 1 ? "example" : "examples"}
              </summary>
              <ul className="ev">{rest.map((item, i) => renderItem(item, i + VISIBLE_EXAMPLES))}</ul>
            </details>
          )}
        </>
      )}
      {assessment.blind_spots && (
        <p className="blind">Not visible here: {assessment.blind_spots}.</p>
      )}
    </div>
  );
}
