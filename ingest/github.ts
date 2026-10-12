/**
 * Read-only GitHub client. Never writes. Requires network + optional GITHUB_TOKEN.
 * Prefer the frozen demo snapshot for offline development.
 */

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { date: string } | null };
  author: { login: string } | null;
  files?: Array<{ filename: string; additions?: number; deletions?: number }>;
}

export interface GitHubPull {
  number: number;
  html_url: string;
  title: string;
  user: { login: string } | null;
  updated_at: string;
  merged_at: string | null;
}

async function ghFetch<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "devskill-ingest",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} for ${url}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Fetch recent commits from a public repo (read-only). */
export async function fetchRepoCommits(
  owner: string,
  repo: string,
  opts: { token?: string; perPage?: number; since?: string } = {},
): Promise<GitHubCommit[]> {
  const perPage = opts.perPage ?? 30;
  let url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`;
  if (opts.since) url += `&since=${encodeURIComponent(opts.since)}`;
  return ghFetch<GitHubCommit[]>(url, opts.token);
}

/** Fetch recent pull requests (read-only). */
export async function fetchRepoPulls(
  owner: string,
  repo: string,
  opts: { token?: string; perPage?: number } = {},
): Promise<GitHubPull[]> {
  const perPage = opts.perPage ?? 20;
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=${perPage}`;
  return ghFetch<GitHubPull[]>(url, opts.token);
}
