import { createHash } from "node:crypto";

/** Stable SHA-256 hex digest. Real identifiers are hashed at the ingest boundary. */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function shortHash(value: string, length = 16): string {
  return sha256(value).slice(0, length);
}

export function hashObject(value: unknown): string {
  return sha256(stableStringify(value));
}

/** Deterministic JSON stringify with sorted keys. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value;
}
