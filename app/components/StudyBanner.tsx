import { ORG_CONFIG } from "@/lib/org-config";

/** Permanent notice: not used for HR decisions; decision rests with the user (DP5, DP3). */
export function StudyBanner() {
  return (
    <div className="study-banner" role="note">
      {ORG_CONFIG.banner}
    </div>
  );
}
