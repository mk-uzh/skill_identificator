const STEP_LABELS = [
  "Introduction",
  "Task 1",
  "Overview",
  "Task 2",
  "Summary",
  "Questions",
];

export function Steps({
  current,
  detail,
}: {
  current: 0 | 1 | 2 | 3 | 4 | 5;
  /** Position inside a task, e.g. "Person 3 of 6". */
  detail?: string;
}) {
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
      {detail && <span className="steps__detail">{detail}</span>}
    </nav>
  );
}
