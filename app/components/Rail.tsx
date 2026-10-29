"use client";

export type RailItem = {
  id: string;
  label: string;
  state: "todo" | "done" | "current";
};

/** All competences of the current person, with where you are and what is left. */
export function Rail({
  title,
  items,
  hint,
  onJump,
}: {
  title: string;
  items: RailItem[];
  hint: string;
  onJump: (index: number) => void;
}) {
  return (
    <nav className="rail" aria-label="Competences">
      <h2 className="rail__title">{title}</h2>
      <ol className="steps2">
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.state === "current" ? "cur" : item.state === "done" ? "done" : ""}
              aria-current={item.state === "current" ? "step" : undefined}
              onClick={() => onJump(i)}
            >
              <span className="dot2">{item.state === "done" ? "✓" : i + 1}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ol>
      <p className="rail__hint" aria-live="polite">
        {hint}
      </p>
    </nav>
  );
}
