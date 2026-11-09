"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Small "i" that opens a window with background information.
 * Opens on hover or keyboard focus, stays open after a click, closes on a click
 * elsewhere or Escape. The content is plain information, never part of the task.
 */
export function InfoTip({
  label,
  children,
  align = "left",
  wide = false,
  onToggle,
}: {
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
  wide?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const open = hover || pinned;
  const was = useRef(false);

  useEffect(() => {
    if (was.current !== open) {
      was.current = open;
      onToggle?.(open);
    }
  }, [open, onToggle]);

  useEffect(() => {
    if (!pinned) return;
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPinned(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [pinned]);

  return (
    <span
      className="tip"
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="tip__btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label={label}
          className={"tip__pop" + (align === "right" ? " tip__pop--r" : "") + (wide ? " tip__pop--wide" : "")}
        >
          {children}
        </span>
      )}
    </span>
  );
}
