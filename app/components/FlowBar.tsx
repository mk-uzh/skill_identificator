"use client";

/**
 * Who am I looking at, and how far along is the study? Stays in view.
 * The competences of this person are in the rail beside the content.
 */
export function FlowBar({
  phase,
  personLabel,
  personIndex,
  personCount,
  right,
}: {
  /** "Task 1" or "Task 2". */
  phase: string;
  personLabel: string;
  personIndex: number;
  personCount: number;
  right?: React.ReactNode;
}) {
  return (
    <section className="fh" aria-label="Progress">
      <div className="fh__in">
        <span className="fh__phase">{phase}</span>
        <div className="fh__who">
          <b>{personLabel}</b>
          <span>
            Person {personIndex + 1} of {personCount}
          </span>
        </div>
        <ol className="pseg" aria-label={`Person ${personIndex + 1} of ${personCount}`}>
          {Array.from({ length: personCount }, (_, i) => (
            <li
              key={i}
              className={i < personIndex ? "done" : i === personIndex ? "cur" : ""}
              aria-current={i === personIndex ? "step" : undefined}
            />
          ))}
        </ol>
        {right && <div className="fh__right">{right}</div>}
      </div>
    </section>
  );
}
