/**
 * Frozen development snapshot shaped like a multi-repo org (public-repo style paths).
 * Used so `infer/` runs fully offline with no network.
 */

import type { Artifact, Snapshot } from "../model/types";
import { hashObject } from "./hash";
import { buildIdentityMapping, mappingToDevelopers } from "./pseudonymise";

const ORG_ID = "demo-org";
const WINDOW_START = "2025-01-01T00:00:00.000Z";
const WINDOW_END = "2025-12-01T00:00:00.000Z";
const CAPTURED_AT = "2025-12-01T10:00:00.000Z";

/** Synthetic GitHub logins — hashed at the boundary; never appear in assessments. */
const DEMO_LOGINS = [
  "alice-ops",
  "bob-sec",
  "carol-data",
  "dave-lead",
  "erin-ui",
  "frank-qa",
];

type RawArtifact = Omit<Artifact, "id" | "developer_id"> & { github_login: string };

function art(
  partial: Omit<RawArtifact, "source" | "size_metrics" | "language" | "ai_assisted"> &
    Partial<Pick<RawArtifact, "source" | "size_metrics" | "language" | "ai_assisted">>,
): RawArtifact {
  return {
    source: partial.source ?? "github",
    language: partial.language ?? null,
    size_metrics: partial.size_metrics ?? {},
    ai_assisted: false,
    ...partial,
  };
}

/** Internal size_metrics may exist but must never drive levels as volume-as-ability. */
const RAW: RawArtifact[] = [
  // Dev A — devops expert
  art({
    github_login: "alice-ops",
    kind: "commit",
    external_id: "e7f8a9b0",
    external_url: "https://github.com/example-org/infra/commit/e7f8a9b0",
    timestamp: "2025-11-02T08:15:00.000Z",
    paths: ["infra/k8s/deploy.yaml", "infra/ci/gitlab-ci.yml"],
    text_excerpt: "ci: migrate deploy jobs to Kubernetes runners",
    size_metrics: { additions: 120, deletions: 40 },
  }),
  art({
    github_login: "alice-ops",
    kind: "pull_request",
    external_id: "92",
    external_url: "https://github.com/example-org/infra/pull/92",
    timestamp: "2025-10-21T16:30:00.000Z",
    paths: ["infra/terraform/modules/network"],
    text_excerpt: "blue/green rollout for payment-service",
  }),
  art({
    github_login: "alice-ops",
    kind: "commit",
    external_id: "sec001ab",
    external_url: "https://github.com/example-org/infra/commit/sec001ab",
    timestamp: "2025-08-27T14:55:00.000Z",
    paths: ["infra/images/Dockerfile"],
    text_excerpt: "chore(images): pin base image and enable Trivy scan",
  }),
  art({
    github_login: "alice-ops",
    kind: "commit",
    external_id: "a1b2c3d4",
    external_url: "https://github.com/example-org/service-api/commit/a1b2c3d4",
    timestamp: "2025-10-14T09:22:00.000Z",
    paths: ["service-api/src/ratelimit.ts"],
    text_excerpt: "fix(api): tighten rate limiter in service-api",
  }),
  art({
    github_login: "alice-ops",
    kind: "review",
    external_id: "418",
    external_url: "https://github.com/example-org/service-api/pull/418",
    timestamp: "2025-09-28T15:40:00.000Z",
    paths: ["service-api/src/billing"],
    text_excerpt: "Review: add idempotency keys to billing endpoints",
  }),
  art({
    github_login: "alice-ops",
    kind: "issue",
    source: "jira",
    external_id: "OPS-301",
    external_url: "https://jira.example.org/browse/OPS-301",
    timestamp: "2025-07-18T13:00:00.000Z",
    paths: [],
    text_excerpt: "Kubernetes Basics internal training",
  }),

  // Dev B — security expert
  art({
    github_login: "bob-sec",
    kind: "commit",
    external_id: "b4d5e6f7",
    external_url: "https://github.com/example-org/auth-service/commit/b4d5e6f7",
    timestamp: "2025-10-05T12:18:00.000Z",
    paths: ["auth-service/src/jwt.ts"],
    text_excerpt: "feat(auth): rotate JWT signing keys without downtime",
  }),
  art({
    github_login: "bob-sec",
    kind: "pull_request",
    external_id: "210",
    external_url: "https://github.com/example-org/auth-service/pull/210",
    timestamp: "2025-09-16T17:05:00.000Z",
    paths: ["auth-service/src/tokens"],
    text_excerpt: "scoped API tokens for partner integrations",
  }),
  art({
    github_login: "bob-sec",
    kind: "review",
    external_id: "455",
    external_url: "https://github.com/example-org/service-api/pull/455",
    timestamp: "2025-11-08T09:50:00.000Z",
    paths: ["service-api/src/oauth"],
    text_excerpt: "Security review: partner OAuth integration",
  }),
  art({
    github_login: "bob-sec",
    kind: "issue",
    source: "jira",
    external_id: "SEC-140",
    external_url: "https://jira.example.org/browse/SEC-140",
    timestamp: "2025-10-19T14:10:00.000Z",
    paths: [],
    text_excerpt: "threat model for payment callbacks",
  }),
  art({
    github_login: "bob-sec",
    kind: "commit",
    external_id: "sec9f0a1",
    external_url: "https://github.com/example-org/auth-service/commit/sec9f0a1",
    timestamp: "2025-08-11T16:25:00.000Z",
    paths: ["auth-service/src/redirects.ts"],
    text_excerpt: "fix(auth): block weak redirect URIs",
  }),

  // Dev C — data expert
  art({
    github_login: "carol-data",
    kind: "commit",
    external_id: "data99ee",
    external_url: "https://github.com/example-org/etl-pipelines/commit/data99ee",
    timestamp: "2025-11-11T10:00:00.000Z",
    paths: ["etl-pipelines/jobs/customer_dim.sql"],
    text_excerpt: "feat(etl): incremental load for customer_dim",
  }),
  art({
    github_login: "carol-data",
    kind: "pull_request",
    external_id: "71",
    external_url: "https://github.com/example-org/etl-pipelines/pull/71",
    timestamp: "2025-08-20T09:15:00.000Z",
    paths: ["etl-pipelines/jobs/fx_rates.sql"],
    text_excerpt: "backfill historical FX rates",
  }),
  art({
    github_login: "carol-data",
    kind: "issue",
    source: "jira",
    external_id: "DATA-201",
    external_url: "https://jira.example.org/browse/DATA-201",
    timestamp: "2025-10-02T13:40:00.000Z",
    paths: [],
    text_excerpt: "redesign weekly revenue mart",
  }),
  art({
    github_login: "carol-data",
    kind: "commit",
    external_id: "te57cafe",
    external_url: "https://github.com/example-org/etl-pipelines/commit/te57cafe",
    timestamp: "2025-10-28T11:05:00.000Z",
    paths: ["etl-pipelines/tests/test_invoices.py"],
    text_excerpt: "test(etl): assert late-arriving invoice rows",
  }),
  art({
    github_login: "carol-data",
    kind: "commit",
    external_id: "be11ac00",
    external_url: "https://github.com/example-org/service-api/commit/be11ac00",
    timestamp: "2025-08-06T15:12:00.000Z",
    paths: ["service-api/src/exports.ts"],
    text_excerpt: "fix(api): expose export status endpoint for ETL",
  }),

  // Dev D — tech lead, broad
  art({
    github_login: "dave-lead",
    kind: "review",
    external_id: "480",
    external_url: "https://github.com/example-org/service-api/pull/480",
    timestamp: "2025-11-05T16:00:00.000Z",
    paths: ["service-api/src/orders"],
    text_excerpt: "Architecture review: event-driven order pipeline",
  }),
  art({
    github_login: "dave-lead",
    kind: "commit",
    external_id: "arch7d01",
    external_url: "https://github.com/example-org/service-api/commit/arch7d01",
    timestamp: "2025-09-25T10:30:00.000Z",
    paths: ["service-api/src/pricing"],
    text_excerpt: "refactor(api): extract pricing domain module",
  }),
  art({
    github_login: "dave-lead",
    kind: "pull_request",
    external_id: "312",
    external_url: "https://github.com/example-org/web-client/pull/312",
    timestamp: "2025-08-14T14:45:00.000Z",
    paths: ["web-client/src/errors"],
    text_excerpt: "shared error-boundary contract for web-client",
  }),
  art({
    github_login: "dave-lead",
    kind: "review",
    external_id: "77",
    external_url: "https://github.com/example-org/infra/pull/77",
    timestamp: "2025-07-22T11:35:00.000Z",
    paths: ["infra/terraform/modules"],
    text_excerpt: "Review: Terraform modules for shared networking",
  }),
  art({
    github_login: "dave-lead",
    kind: "review",
    external_id: "471",
    external_url: "https://github.com/example-org/service-api/pull/471",
    timestamp: "2025-10-30T12:50:00.000Z",
    paths: ["service-api/src/webhooks"],
    text_excerpt: "Review: harden webhook signature verification",
  }),
  art({
    github_login: "dave-lead",
    kind: "issue",
    source: "jira",
    external_id: "SEC-133",
    external_url: "https://jira.example.org/browse/SEC-133",
    timestamp: "2025-09-18T10:15:00.000Z",
    paths: [],
    text_excerpt: "privilege model for admin APIs",
  }),

  // Dev E — frontend expert
  art({
    github_login: "erin-ui",
    kind: "commit",
    external_id: "fe0a11bb",
    external_url: "https://github.com/example-org/ui-components/commit/fe0a11bb",
    timestamp: "2025-11-03T09:40:00.000Z",
    paths: ["ui-components/src/Combobox.tsx"],
    text_excerpt: "feat(ui): accessible combobox for filter bars",
  }),
  art({
    github_login: "erin-ui",
    kind: "pull_request",
    external_id: "188",
    external_url: "https://github.com/example-org/ui-components/pull/188",
    timestamp: "2025-10-16T16:10:00.000Z",
    paths: ["ui-components/tokens"],
    text_excerpt: "design-token sync with Figma",
  }),
  art({
    github_login: "erin-ui",
    kind: "issue",
    source: "jira",
    external_id: "UI-101",
    external_url: "https://jira.example.org/browse/UI-101",
    timestamp: "2025-08-25T11:55:00.000Z",
    paths: [],
    text_excerpt: "accessibility audit remediation",
  }),
  art({
    github_login: "erin-ui",
    kind: "commit",
    external_id: "viz4d4ta",
    external_url: "https://github.com/example-org/web-client/commit/viz4d4ta",
    timestamp: "2025-10-07T15:30:00.000Z",
    paths: ["web-client/src/charts/Sparkline.tsx"],
    text_excerpt: "feat(charts): reusable sparkline for KPI cards",
  }),

  // Dev F — testing focus
  art({
    github_login: "frank-qa",
    kind: "commit",
    external_id: "e2e88f00",
    external_url: "https://github.com/example-org/tests/commit/e2e88f00",
    timestamp: "2025-11-06T13:15:00.000Z",
    paths: ["tests/e2e/checkout.spec.ts"],
    text_excerpt: "test(e2e): cover checkout retry path",
  }),
  art({
    github_login: "frank-qa",
    kind: "pull_request",
    external_id: "18",
    external_url: "https://github.com/example-org/tests/pull/18",
    timestamp: "2025-10-01T09:05:00.000Z",
    paths: ["tests/e2e/fixtures"],
    text_excerpt: "stabilise login fixture across browsers",
  }),
  art({
    github_login: "frank-qa",
    kind: "commit",
    external_id: "ci7e57aa",
    external_url: "https://github.com/example-org/web-client/commit/ci7e57aa",
    timestamp: "2025-10-11T08:55:00.000Z",
    paths: [".github/workflows/e2e.yml"],
    text_excerpt: "ci(tests): retry flaky Playwright jobs twice",
  }),
  art({
    github_login: "frank-qa",
    kind: "commit",
    external_id: "featur01",
    external_url: "https://github.com/example-org/web-client/commit/featur01",
    timestamp: "2025-10-23T14:20:00.000Z",
    paths: ["web-client/src/inbox/EmptyState.tsx"],
    text_excerpt: "feat(web): empty-state for notification inbox",
  }),
  art({
    github_login: "frank-qa",
    kind: "issue",
    source: "jira",
    external_id: "QA-44",
    external_url: "https://jira.example.org/browse/QA-44",
    timestamp: "2025-09-20T10:30:00.000Z",
    paths: [],
    text_excerpt: "expand regression pack for release 2025.10",
  }),
];

export function buildDemoSnapshot(): { snapshot: Snapshot; mappingPlaintextLogins: string[] } {
  const mapping = buildIdentityMapping(ORG_ID, DEMO_LOGINS);
  const developers = mappingToDevelopers(mapping);
  const loginToId = new Map(mapping.entries.map((e) => [e.github_login, e.developer_id]));

  const artifacts: Artifact[] = RAW.map((raw, index) => {
    const developer_id = loginToId.get(raw.github_login);
    if (!developer_id) {
      throw new Error(`Unmapped login ${raw.github_login}`);
    }
    const { github_login: _login, ...rest } = raw;
    return {
      id: `art-${String(index + 1).padStart(4, "0")}`,
      developer_id,
      ...rest,
    };
  });

  // Sort for determinism
  artifacts.sort((a, b) => a.id.localeCompare(b.id));

  const body = {
    organization: {
      id: ORG_ID,
      name: "Demo Organization",
      taxonomy_version: "1.0",
      observation_window_start: WINDOW_START,
      observation_window_end: WINDOW_END,
    },
    developers: developers.sort((a, b) => a.id.localeCompare(b.id)),
    artifacts,
    captured_at: CAPTURED_AT,
    source_repos: [
      "example-org/infra",
      "example-org/service-api",
      "example-org/auth-service",
      "example-org/etl-pipelines",
      "example-org/web-client",
      "example-org/ui-components",
      "example-org/tests",
    ],
  };

  const snapshot: Snapshot = {
    ...body,
    snapshot_hash: hashObject(body),
  };

  return { snapshot, mappingPlaintextLogins: DEMO_LOGINS };
}
