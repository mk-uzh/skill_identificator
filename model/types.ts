/** Domain entities for ingest + infer (Spec §4). */

export type ArtifactSource = "github" | "jira";
export type ArtifactKind = "commit" | "pull_request" | "review" | "issue";

export interface Organization {
  id: string;
  name: string;
  taxonomy_version: string;
  observation_window_start: string;
  observation_window_end: string;
}

/** Pseudonymous developer — real logins never leave ingest/. */
export interface Developer {
  id: string;
  org_id: string;
  github_login_hash: string;
  jira_account_hash: string | null;
  display_label: string;
}

export interface Artifact {
  id: string;
  developer_id: string;
  source: ArtifactSource;
  kind: ArtifactKind;
  external_id: string;
  external_url: string;
  timestamp: string;
  paths: string[];
  language: string | null;
  /** Internal metrics only — never surfaced as ability in assessments/UI. */
  size_metrics: Record<string, number>;
  text_excerpt: string;
  /** Spec DP11 — reserved; excluded from scoring until validated. */
  ai_assisted?: boolean;
}

export interface Snapshot {
  organization: Organization;
  developers: Developer[];
  artifacts: Artifact[];
  /** Content hash of the raw inputs after pseudonymisation. */
  snapshot_hash: string;
  captured_at: string;
  /** Public repo used for the development snapshot, if any. */
  source_repos: string[];
}

export interface TaxonomyConcept {
  uri?: string;
  label: string;
  source: "esco" | "local";
  /** Path / keyword patterns that map artifacts onto this concept. */
  path_patterns: string[];
  text_patterns: string[];
}

export interface TaxonomyCategory {
  key: string;
  label: string;
  description: string;
  order: number;
  anchors: Record<"none" | "basic" | "proficient" | "expert", string>;
  concepts: TaxonomyConcept[];
}

export interface TaxonomyConfig {
  taxonomy_version: string;
  esco_version: string;
  esco_retrieved_at: string;
  categories: TaxonomyCategory[];
}
