const STEP_LABELS = ["Introduction", "Task 1", "Task 2", "Wrap-up"];

export function Steps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <nav className="steps" aria-label="Progress">
      {STEP_LABELS.map((label, i) => (
        <span
          key={label}
          className={
            "steps__item" +
            (i === current ? " steps__item--active" : i < current ? " steps__item--done" : "")
          }
          aria-current={i === current ? "step" : undefined}
        >
          {label}
        </span>
      ))}
    </nav>
  );
}
