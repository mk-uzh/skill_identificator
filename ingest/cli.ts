/**
 * Ingest CLI — builds a pseudonymised snapshot.
 *
 *   npx tsx ingest/cli.ts --mode demo
 *   npx tsx ingest/cli.ts --mode github --repo vercel/next.js
 *
 * Demo mode is offline. GitHub mode is read-only and optional.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Artifact, Snapshot } from "../model/types";
import { buildDemoSnapshot } from "./demo-snapshot";
import { fetchRepoCommits, fetchRepoPulls } from "./github";
import { hashObject } from "./hash";
import { writeSnapshotBundle } from "./persist";
import {
  buildIdentityMapping,
  mappingToDevelopers,
  type IdentityMapping,
} from "./pseudonymise";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function runDemo(): Promise<void> {
  const { snapshot } = buildDemoSnapshot();
  const mapping = buildIdentityMapping(
    snapshot.organization.id,
    ["alice-ops", "bob-sec", "carol-data", "dave-lead", "erin-ui", "frank-qa"],
  );
  const { snapshotPath, mappingPath } = await writeSnapshotBundle(ROOT, snapshot, mapping, {
    redactMapping: false,
  });
  console.log(`Wrote demo snapshot (offline): ${snapshotPath}`);
  console.log(`Wrote identity mapping (demo only): ${mappingPath}`);
  console.log(`snapshot_hash=${snapshot.snapshot_hash}`);
}

async function runGitHub(repo: string): Promise<void> {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error("--repo must be owner/name");
  }
  const token = process.env.GITHUB_TOKEN;
  const orgId = "demo-org";
  const since = "2024-01-01T00:00:00.000Z";

  console.log(`Fetching read-only data from ${repo} …`);
  const [commits, pulls] = await Promise.all([
    fetchRepoCommits(owner, name, { token, perPage: 40, since }),
    fetchRepoPulls(owner, name, { token, perPage: 20 }),
  ]);

  const logins = [
    ...commits.map((c) => c.author?.login).filter(Boolean),
    ...pulls.map((p) => p.user?.login).filter(Boolean),
  ] as string[];

  const mapping: IdentityMapping = buildIdentityMapping(orgId, logins);
  const developers = mappingToDevelopers(mapping);
  const loginToId = new Map(mapping.entries.map((e) => [e.github_login, e.developer_id]));

  const artifacts: Artifact[] = [];
  let n = 0;

  for (const commit of commits) {
    const login = commit.author?.login;
    if (!login) continue;
    const developer_id = loginToId.get(login);
    if (!developer_id) continue;
    n += 1;
    artifacts.push({
      id: `art-${String(n).padStart(4, "0")}`,
      developer_id,
      source: "github",
      kind: "commit",
      external_id: commit.sha.slice(0, 8),
      external_url: commit.html_url,
      timestamp: commit.commit.author?.date ?? new Date().toISOString(),
      paths: (commit.files ?? []).map((f) => f.filename),
      language: null,
      size_metrics: {
        // Internal only — never used as ability in infer output text
        additions: (commit.files ?? []).reduce((s, f) => s + (f.additions ?? 0), 0),
        deletions: (commit.files ?? []).reduce((s, f) => s + (f.deletions ?? 0), 0),
      },
      text_excerpt: commit.commit.message.split("\n")[0] ?? "",
      ai_assisted: false,
    });
  }

  for (const pull of pulls) {
    const login = pull.user?.login;
    if (!login) continue;
    const developer_id = loginToId.get(login);
    if (!developer_id) continue;
    n += 1;
    artifacts.push({
      id: `art-${String(n).padStart(4, "0")}`,
      developer_id,
      source: "github",
      kind: "pull_request",
      external_id: String(pull.number),
      external_url: pull.html_url,
      timestamp: pull.merged_at ?? pull.updated_at,
      paths: [],
      language: null,
      size_metrics: {},
      text_excerpt: pull.title,
      ai_assisted: false,
    });
  }

  artifacts.sort((a, b) => a.id.localeCompare(b.id));

  const body = {
    organization: {
      id: orgId,
      name: `GitHub ${repo}`,
      taxonomy_version: "1.0",
      observation_window_start: since,
      observation_window_end: new Date().toISOString(),
    },
    developers: developers.sort((a, b) => a.id.localeCompare(b.id)),
    artifacts,
    captured_at: new Date().toISOString(),
    source_repos: [repo],
  };

  const snapshot: Snapshot = { ...body, snapshot_hash: hashObject(body) };
  const { snapshotPath } = await writeSnapshotBundle(ROOT, snapshot, mapping, {
    redactMapping: true,
  });
  console.log(`Wrote GitHub snapshot: ${snapshotPath}`);
  console.log(`Developers mapped: ${developers.length}; artifacts: ${artifacts.length}`);
  console.log("Mapping file redacted (plaintext logins stripped).");
}

async function main(): Promise<void> {
  const mode = argValue("--mode") ?? "demo";
  if (mode === "demo") {
    await runDemo();
    return;
  }
  if (mode === "github") {
    const repo = argValue("--repo");
    if (!repo) throw new Error("--repo owner/name required for github mode");
    await runGitHub(repo);
    return;
  }
  throw new Error(`Unknown mode ${mode}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
