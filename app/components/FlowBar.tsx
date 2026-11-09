"use client";

import { InfoTip } from "@/components/InfoTip";
import { ORG_CONFIG, VISIBILITY_LABELS } from "@/lib/org-config";

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
        <div className="fh__right">
          <span className="fh__vis">
            Who can see this
            <InfoTip label="Who can see this" align="right">
              <span className="tipbody">
                <span className="tipbody__p">
                  In this study the setting is fixed to <b>{VISIBILITY_LABELS[ORG_CONFIG.visibility]}</b>,
                  so that every participant sees the same thing.
                </span>
                <span className="tipbody__p">
                  In real use an organisation chooses one of three settings before the system is
                  switched on: the team lead only, the whole team, or the developer and their lead.
                  The profile never goes to a personnel system.
                </span>
              </span>
            </InfoTip>
          </span>
          {right}
        </div>
      </div>
    </section>
  );
}
