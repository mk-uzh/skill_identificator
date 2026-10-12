import type { Developer } from "../model/types";
import { shortHash } from "./hash";

export interface IdentityMapping {
  /** Never commit real mappings from partner orgs. Demo mappings may be committed. */
  org_id: string;
  entries: Array<{
    display_label: string;
    developer_id: string;
    github_login: string;
    jira_account: string | null;
    github_login_hash: string;
    jira_account_hash: string | null;
  }>;
}

const DISPLAY_LABELS = ["Dev A", "Dev B", "Dev C", "Dev D", "Dev E", "Dev F"];
const DEVELOPER_IDS = ["devA", "devB", "devC", "devD", "devE", "devF"];

/**
 * Pseudonymise at the ingest boundary.
 * Real logins are hashed; at most six contributors are mapped onto the study UI slots.
 */
export function buildIdentityMapping(
  orgId: string,
  githubLogins: string[],
  jiraAccounts: Record<string, string | null> = {},
): IdentityMapping {
  const unique = Array.from(new Set(githubLogins.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
  const capped = unique.slice(0, DEVELOPER_IDS.length);

  const entries = capped.map((login, index) => {
    const jira = jiraAccounts[login] ?? null;
    return {
      display_label: DISPLAY_LABELS[index],
      developer_id: DEVELOPER_IDS[index],
      github_login: login,
      jira_account: jira,
      github_login_hash: shortHash(`github:${login}`),
      jira_account_hash: jira ? shortHash(`jira:${jira}`) : null,
    };
  });

  return { org_id: orgId, entries };
}

export function mappingToDevelopers(mapping: IdentityMapping): Developer[] {
  return mapping.entries.map((entry) => ({
    id: entry.developer_id,
    org_id: mapping.org_id,
    github_login_hash: entry.github_login_hash,
    jira_account_hash: entry.jira_account_hash,
    display_label: entry.display_label,
  }));
}

export function loginToDeveloperId(
  mapping: IdentityMapping,
  githubLogin: string,
): string | null {
  const entry = mapping.entries.find((e) => e.github_login === githubLogin);
  return entry?.developer_id ?? null;
}

/** Strip plaintext logins before anything leaves ingest/. */
export function redactMappingForExport(mapping: IdentityMapping): IdentityMapping {
  return {
    org_id: mapping.org_id,
    entries: mapping.entries.map((e) => ({
      ...e,
      github_login: `[redacted:${e.github_login_hash.slice(0, 8)}]`,
      jira_account: e.jira_account
        ? `[redacted:${e.jira_account_hash?.slice(0, 8)}]`
        : null,
    })),
  };
}
