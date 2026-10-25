-- Bronze: raw data, unchanged. No cleaning, no renaming.
-- payload holds the complete response of the source as JSON text.

CREATE TABLE IF NOT EXISTS tbl_brz_fetch_log (
  log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  params      TEXT,
  n_items     INTEGER
);

-- --- GitHub / Git ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_brz_gh_commit (
  sha           TEXT PRIMARY KEY,
  fetched_at    TEXT NOT NULL,
  authored_at   TEXT,
  author_name   TEXT,
  author_email  TEXT,
  subject       TEXT,
  payload       TEXT NOT NULL      -- full commit incl. body, trailers, files
);
CREATE INDEX IF NOT EXISTS ix_tbl_brz_commit_date ON tbl_brz_gh_commit(authored_at);

CREATE TABLE IF NOT EXISTS tbl_brz_gh_pull (
  pr_number   INTEGER PRIMARY KEY,
  fetched_at  TEXT NOT NULL,
  state       TEXT,
  merged_at   TEXT,
  payload     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tbl_brz_gh_review (
  review_id   INTEGER PRIMARY KEY,
  pr_number   INTEGER NOT NULL,
  fetched_at  TEXT NOT NULL,
  payload     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tbl_brz_review_pr ON tbl_brz_gh_review(pr_number);

CREATE TABLE IF NOT EXISTS tbl_brz_gh_review_comment (
  comment_id  INTEGER PRIMARY KEY,
  pr_number   INTEGER NOT NULL,
  fetched_at  TEXT NOT NULL,
  payload     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tbl_brz_rcomment_pr ON tbl_brz_gh_review_comment(pr_number);

-- --- Jira -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_brz_ji_issue (
  issue_key   TEXT PRIMARY KEY,
  fetched_at  TEXT NOT NULL,
  created_at  TEXT,
  updated_at  TEXT,
  payload     TEXT NOT NULL      -- fields=*all incl. comments and changelog
);
CREATE INDEX IF NOT EXISTS ix_tbl_brz_issue_created ON tbl_brz_ji_issue(created_at);

CREATE TABLE IF NOT EXISTS tbl_brz_ji_comment (
  comment_id  TEXT PRIMARY KEY,
  issue_key   TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  payload     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tbl_brz_jcomment_issue ON tbl_brz_ji_comment(issue_key);

CREATE TABLE IF NOT EXISTS tbl_brz_gh_commit_patch (
  sha          TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  fetched_at   TEXT NOT NULL,
  n_added      INTEGER,
  n_removed    INTEGER,
  is_truncated INTEGER,
  added_lines  TEXT,              -- added lines only, capped per file
  PRIMARY KEY (sha, file_path)
);
CREATE INDEX IF NOT EXISTS ix_tbl_brz_patch_sha ON tbl_brz_gh_commit_patch(sha);
