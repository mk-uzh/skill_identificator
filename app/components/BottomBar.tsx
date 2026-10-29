"use client";

/** Fixed bar: back on the left, where you are in the middle, the way on on the right. */
export function BottomBar({
  text,
  onBack,
  backDisabled,
  children,
}: {
  text: string;
  onBack?: () => void;
  backDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <footer className="bbar">
      <div className="bbar__in">
        {onBack && (
          <button type="button" className="btn btn--ghost" disabled={backDisabled} onClick={onBack}>
            ← Back
          </button>
        )}
        <p className="bbar__text">{text}</p>
        <div className="bbar__go">{children}</div>
      </div>
    </footer>
  );
}
