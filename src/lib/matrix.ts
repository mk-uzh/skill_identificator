import { CATEGORIES, DEVELOPERS } from "./study-config";
import { SKILL_LEVELS, type Matrix, type SkillLevel } from "./types";

export function emptyMatrix(): Matrix {
  const matrix: Matrix = {};
  for (const developer of DEVELOPERS) {
    matrix[developer.id] = {};
    for (const category of CATEGORIES) {
      matrix[developer.id][category.id] = null;
    }
  }
  return matrix;
}

/** Fills every cell with a random skill level (for local testing). */
export function randomMatrix(): Matrix {
  const matrix: Matrix = {};
  for (const developer of DEVELOPERS) {
    matrix[developer.id] = {};
    for (const category of CATEGORIES) {
      const index = Math.floor(Math.random() * SKILL_LEVELS.length);
      matrix[developer.id][category.id] = SKILL_LEVELS[index];
    }
  }
  return matrix;
}

export function cloneMatrix(source: Matrix): Matrix {
  const copy: Matrix = {};
  for (const [devId, byCategory] of Object.entries(source)) {
    copy[devId] = { ...byCategory };
  }
  return copy;
}

export function setCell(
  matrix: Matrix,
  devId: string,
  categoryId: string,
  value: SkillLevel | null,
): Matrix {
  const next = cloneMatrix(matrix);
  if (!next[devId]) next[devId] = {};
  next[devId][categoryId] = value;
  return next;
}

export function countFilled(matrix: Matrix): number {
  return Object.values(matrix).reduce(
    (total, byCategory) => total + Object.values(byCategory).filter(Boolean).length,
    0,
  );
}

export const TOTAL_CELLS = DEVELOPERS.length * CATEGORIES.length;

export function isComplete(matrix: Matrix): boolean {
  return countFilled(matrix) === TOTAL_CELLS;
}
