"use client";

// ---------------------------------------------------------------------------
// Interaction logger
//
// Collects events in memory and sends them in batches to /api/events (every
// 4 seconds or when leaving the page). This avoids one request per click while
// keeping the log complete.
// ---------------------------------------------------------------------------

import type { EventType, SkillLevel, StudyEvent } from "./types";

const FLUSH_INTERVAL_MS = 4000;

class StudyLogger {
  private queue: StudyEvent[] = [];
  private sessionId: string | null = null;
  private task: 0 | 1 | 2 = 0;
  private taskStart = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private listenersAttached = false;

  start(sessionId: string, task: 0 | 1 | 2): void {
    this.sessionId = sessionId;
    this.task = task;
    this.taskStart = Date.now();

    if (this.timer === null) {
      this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    }
    if (!this.listenersAttached && typeof window !== "undefined") {
      window.addEventListener("blur", () => this.log("window_blur"));
      window.addEventListener("focus", () => this.log("window_focus"));
      window.addEventListener("pagehide", () => this.flushBeacon());
      this.listenersAttached = true;
    }
  }

  /** ms since the start of the current task – also usable for durations. */
  elapsed(): number {
    return Date.now() - this.taskStart;
  }

  log(
    type: EventType,
    details: {
      devId?: string;
      categoryId?: string;
      from?: SkillLevel | null;
      to?: SkillLevel | null;
      suggested?: SkillLevel;
      meta?: Record<string, unknown>;
    } = {},
  ): void {
    if (!this.sessionId) return;
    this.queue.push({
      ts: new Date().toISOString(),
      tMs: this.elapsed(),
      sessionId: this.sessionId,
      task: this.task,
      type,
      ...details,
    });
  }

  async flush(): Promise<void> {
    if (!this.sessionId || this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.sessionId, events: batch }),
        keepalive: true,
      });
    } catch {
      // on network error put back into the queue, next attempt in 4s
      this.queue = batch.concat(this.queue);
    }
  }

  /** When the tab closes: sendBeacon survives the unload more reliably. */
  private flushBeacon(): void {
    if (!this.sessionId || this.queue.length === 0) return;
    const payload = JSON.stringify({ sessionId: this.sessionId, events: this.queue });
    this.queue = [];
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
    }
  }
}

export const logger = new StudyLogger();
