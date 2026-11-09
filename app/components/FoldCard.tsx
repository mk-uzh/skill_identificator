"use client";

/** A card that is closed until the reader opens it. The "i" next to the title does not open or close it. */
export function FoldCard({
  title,
  info,
  children,
  onOpen,
}: {
  title: string;
  info?: React.ReactNode;
  children: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <details
      className="card foldcard"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) onOpen?.();
      }}
    >
      <summary>
        <h3>
          {title}
          {info}
        </h3>
      </summary>
      <div className="foldcard__body">{children}</div>
    </details>
  );
}
