// ---------------------------------------------------------------------------
// Study flow
//
// Two tasks, each walked person by person:
//
//   Introduction
//   Task 1    person 1 .. 6, own assessment, one person per screen
//   Overview  everything entered so far, still editable
//   Task 2    person 1 .. 6, the system's view, one competence per screen
//   Summary   what changed, and which role the evidence matches
//   Questions short questionnaire
//
// Task 1 is finished for everybody before the first suggestion appears, so no
// rating is made after seeing how the system behaves. The cost is distance:
// by the time a person comes up again in task 2, their records were read a
// while ago, which is why task 2 shows the same records again rather than
// expecting the participant to remember them.
//
// A learning effect across people remains inside each task. It is controlled
// rather than avoided: the order of the people is permuted per participant
// and the block index is recorded, so drift across positions can be analysed
// instead of being confounded with the people themselves.
// ---------------------------------------------------------------------------

import { DEVELOPERS } from "./study-config";

/** "own" = participant rates alone, "system" = suggestions shown. */
export type Phase = "own" | "system";

export const PERSONS_PER_PARTICIPANT = 3;
export const BLOCK_COUNT = Math.min(PERSONS_PER_PARTICIPANT, DEVELOPERS.length);

/** FNV-1a. Deterministic so a reload cannot reshuffle the order. */
function hashCode(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Developer order for one participant. Derived from the participant code, so
 * it is stable across reloads, identical on client and server, and can be
 * reconstructed during analysis without reading the session file.
 */
export function developerOrder(participantCode: string): string[] {
  const ids = DEVELOPERS.map((d) => d.id);
  const random = mulberry32(hashCode(participantCode || "default"));
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, BLOCK_COUNT);
}

export function parseBlock(raw: string | null | undefined): number {
  const parsed = Number.parseInt(raw ?? "0", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, BLOCK_COUNT - 1);
}

export function isLastBlock(block: number): boolean {
  return block >= BLOCK_COUNT - 1;
}

/** Reads ?block= on the client without needing a Suspense boundary. */
export function blockFromLocation(): number {
  if (typeof window === "undefined") return 0;
  return parseBlock(new URLSearchParams(window.location.search).get("block"));
}

export function ownHref(block: number): string {
  return `/task1?block=${block}`;
}

export function systemHref(block: number): string {
  return `/task2?block=${block}`;
}

export const OVERVIEW_HREF = "/overview";
export const SUMMARY_HREF = "/summary";

/** Where task 1 goes after this person. */
export function afterOwn(block: number): string {
  return isLastBlock(block) ? OVERVIEW_HREF : ownHref(block + 1);
}

/** Where task 2 goes after this person. */
export function afterSystem(block: number): string {
  return isLastBlock(block) ? SUMMARY_HREF : systemHref(block + 1);
}

/**
 * Which competences the comparison step walks through for a person.
 *
 * "all" follows the design we drew: every competence gets its own screen with
 * the records, the proposal and the decision. "differing" shows only the ones
 * where the system does not already agree with the participant, which roughly
 * halves the clicks but means the participant never sees the system confirm
 * them — and agreement is itself something the study may want to observe.
 */
export const COMPARISON_STEPS: "all" | "differing" = "all";
