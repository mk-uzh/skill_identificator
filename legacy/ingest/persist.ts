import { promises as fs } from "node:fs";
import path from "node:path";
import type { Snapshot } from "../../model/types";
import type { IdentityMapping } from "./pseudonymise";
import { redactMappingForExport } from "./pseudonymise";

export function snapshotDir(root: string, orgId: string): string {
  return path.join(root, "tests", "fixtures", orgId);
}

export async function writeSnapshotBundle(
  root: string,
  snapshot: Snapshot,
  mapping: IdentityMapping,
  opts: { redactMapping?: boolean } = {},
): Promise<{ snapshotPath: string; mappingPath: string }> {
  const dir = snapshotDir(root, snapshot.organization.id);
  await fs.mkdir(dir, { recursive: true });

  const snapshotPath = path.join(dir, "snapshot.json");
  const mappingPath = path.join(dir, "mapping.json");

  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  const toWrite = opts.redactMapping ? redactMappingForExport(mapping) : mapping;
  await fs.writeFile(mappingPath, JSON.stringify(toWrite, null, 2) + "\n", "utf8");

  return { snapshotPath, mappingPath };
}

export async function readSnapshot(root: string, orgId: string): Promise<Snapshot> {
  const file = path.join(snapshotDir(root, orgId), "snapshot.json");
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as Snapshot;
}
