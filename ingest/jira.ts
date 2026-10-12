/**
 * Read-only Jira client.
 * Live calls require JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN.
 * Without credentials, load issues from a local fixture (offline).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export interface JiraIssueFixture {
  key: string;
  summary: string;
  updated: string;
  assignee_login: string | null;
  url: string;
}

export async function loadJiraFixture(fixturePath: string): Promise<JiraIssueFixture[]> {
  const raw = await fs.readFile(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as { issues: JiraIssueFixture[] };
  return parsed.issues ?? [];
}

/** Optional live search — never used by the offline demo path. */
export async function fetchJiraIssues(jql: string): Promise<JiraIssueFixture[]> {
  const base = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!base || !email || !token) {
    throw new Error(
      "Jira credentials missing (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN). Use the demo snapshot or a fixture.",
    );
  }

  const url = `${base.replace(/\/$/, "")}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50`;
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Jira ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    issues: Array<{
      key: string;
      fields: {
        summary: string;
        updated: string;
        assignee?: { accountId?: string; displayName?: string } | null;
      };
    }>;
  };

  return data.issues.map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    updated: issue.fields.updated,
    assignee_login: issue.fields.assignee?.accountId ?? null,
    url: `${base.replace(/\/$/, "")}/browse/${issue.key}`,
  }));
}

export function defaultJiraFixturePath(root: string): string {
  return path.join(root, "data", "snapshots", "demo-org", "jira-fixture.json");
}
