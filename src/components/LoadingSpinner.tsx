/** Dual-tone green spinner matching the study design. */
export function LoadingSpinner({
  label = "Loading …",
  fullPage = false,
}: {
  label?: string;
  fullPage?: boolean;
}) {
  return (
    <div
      className={fullPage ? "loading-overlay" : "loading-inline"}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="loading-spinner" aria-hidden="true" />
      <span className="loading-label">{label}</span>
    </div>
  );
}
