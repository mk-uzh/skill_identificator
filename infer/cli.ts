/**
 * Headless inference CLI — no UI, no network.
 *
 *   npx tsx infer/cli.ts
 *   npx tsx infer/cli.ts --org demo-org
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInference } from "./run";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const orgId = argValue("--org") ?? "demo-org";
  const file = await runInference({ root: ROOT, orgId });
  console.log(`Wrote ${file.assessments.length} assessments → data/assessments.json`);
  console.log(`organization_id=${file.organization_id}`);
  console.log(`config_hash=${file.config_hash}`);
  console.log(`computed_at=${file.computed_at}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
