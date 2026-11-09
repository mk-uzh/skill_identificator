"use client";

import { Fragment, useEffect, useRef } from "react";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/study-config";

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
  const listRef = useRef<HTMLOListElement>(null);

  // On narrow screens the list is a row you swipe; keep the current competence in view.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 900px)").matches) return;
    const current = listRef.current?.querySelector<HTMLElement>(".cur");
    current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [items]);

  return (
    <nav className="rail" aria-label="Competences">
      <h2 className="rail__title">{title}</h2>
      <ol className="steps2" ref={listRef}>
        {items.map((item, i) => {
          const groupId = CATEGORIES.find((c) => c.id === item.id)?.groupId;
          const prevId = i > 0 ? CATEGORIES.find((c) => c.id === items[i - 1].id)?.groupId : undefined;
          const groupLabel =
            groupId && groupId !== prevId ? CATEGORY_GROUPS.find((g) => g.id === groupId)?.label : null;
          return (
          <Fragment key={item.id}>
          {groupLabel && (
            <li className="steps2__group" aria-hidden="true">
              {groupLabel}
            </li>
          )}
          <li>
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
          </Fragment>
          );
        })}
      </ol>
      <p className="rail__hint" aria-live="polite">
        {hint}
      </p>
    </nav>
  );
}
