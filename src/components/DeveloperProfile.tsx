"use client";

import { useEffect } from "react";
import type { Developer } from "@/lib/types";

export function DeveloperProfile({
  developer,
  onClose,
  showEvidence = true,
}: {
  developer: Developer;
  onClose: () => void;
  /** Task 1: no evidence anywhere on the screen (spec §7). */
  showEvidence?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Profile ${developer.label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{developer.label}</h3>
        <p className="small muted" style={{ margin: 0 }}>
          {developer.role} · {developer.tenure}
        </p>
        <p style={{ marginTop: 12 }}>{developer.profile}</p>
        {showEvidence && (
          <>
            <strong className="small">Available evidence</strong>
            <ul>
              {developer.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
        <div className="actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
