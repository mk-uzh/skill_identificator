-- Silver: normalised, identities merged, pseudonyms only.
-- No names, no e-mail addresses. Filtering uses flags, never deletion.

CREATE TABLE IF NOT EXISTS tbl_slv_developer (
  dev_id           TEXT PRIMARY KEY,
  dev_hash         TEXT NOT NULL,
  n_commits        INTEGER,
  n_identities     INTEGER,
  first_commit_at  TEXT,
  last_commit_at   TEXT,
  is_bot           INTEGER DEFAULT 0,
  in_scope         INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tbl_slv_commit (
  sha             TEXT PRIMARY KEY,
  dev_id          TEXT REFERENCES tbl_slv_developer(dev_id),
  issue_key       TEXT,
  pr_number       INTEGER,
  authored_at     TEXT,
  subject         TEXT,
  body            TEXT,
  n_files         INTEGER,
  is_merge        INTEGER DEFAULT 0,
  is_ai_assisted  INTEGER DEFAULT 0,
  ai_tool         TEXT,
  in_window       INTEGER DEFAULT 1,
  has_issue       INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_tbl_slv_commit_dev   ON tbl_slv_commit(dev_id);
CREATE INDEX IF NOT EXISTS ix_tbl_slv_commit_issue ON tbl_slv_commit(issue_key);

CREATE TABLE IF NOT EXISTS tbl_slv_commit_file (
  sha          TEXT NOT NULL REFERENCES tbl_slv_commit(sha),
  file_path    TEXT NOT NULL,
  change_type  TEXT,
  language     TEXT,
  module       TEXT,
  layer_rule   TEXT,            -- provisional, later replaced by the model
  PRIMARY KEY (sha, file_path)
);
CREATE INDEX IF NOT EXISTS ix_tbl_slv_file_sha ON tbl_slv_commit_file(sha);

CREATE TABLE IF NOT EXISTS tbl_slv_commit_patch (
  sha           TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  n_added       INTEGER,
  n_removed     INTEGER,
  is_truncated  INTEGER,
  added_lines   TEXT,
  PRIMARY KEY (sha, file_path)
);

CREATE TABLE IF NOT EXISTS tbl_slv_issue (
  issue_key           TEXT PRIMARY KEY,
  issue_type          TEXT,
  status              TEXT,
  resolution          TEXT,
  priority            TEXT,
  summary             TEXT,
  description         TEXT,
  created_at          TEXT,
  updated_at          TEXT,
  resolved_at         TEXT,
  reporter_dev_id     TEXT,
  reporter_acct_hash  TEXT,
  assignee_dev_id     TEXT,
  assignee_acct_hash  TEXT,
  n_comments          INTEGER
);

CREATE TABLE IF NOT EXISTS tbl_slv_issue_component (
  issue_key  TEXT NOT NULL REFERENCES tbl_slv_issue(issue_key),
  component  TEXT NOT NULL,
  PRIMARY KEY (issue_key, component)
);

CREATE TABLE IF NOT EXISTS tbl_slv_issue_label (
  issue_key  TEXT NOT NULL REFERENCES tbl_slv_issue(issue_key),
  label      TEXT NOT NULL,
  PRIMARY KEY (issue_key, label)
);

CREATE TABLE IF NOT EXISTS tbl_slv_issue_comment (
  comment_id      TEXT PRIMARY KEY,
  issue_key       TEXT NOT NULL REFERENCES tbl_slv_issue(issue_key),
  author_dev_id   TEXT,
  author_acct_hash TEXT,
  created_at      TEXT,
  body            TEXT,
  is_bot          INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tbl_slv_pull_request (
  pr_number        INTEGER PRIMARY KEY,
  author_dev_id    TEXT,
  author_login_hash TEXT,
  issue_key        TEXT,
  title            TEXT,
  body             TEXT,
  state            TEXT,
  is_merged        INTEGER DEFAULT 0,
  created_at       TEXT,
  merged_at        TEXT,
  n_reviews        INTEGER
);

CREATE TABLE IF NOT EXISTS tbl_slv_review (
  review_id          INTEGER PRIMARY KEY,
  pr_number          INTEGER REFERENCES tbl_slv_pull_request(pr_number),
  reviewer_dev_id    TEXT,
  reviewer_login_hash TEXT,
  state              TEXT,
  submitted_at       TEXT,
  body               TEXT,
  is_bot             INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_tbl_slv_review_pr ON tbl_slv_review(pr_number);

CREATE TABLE IF NOT EXISTS tbl_slv_review_comment (
  comment_id         INTEGER PRIMARY KEY,
  pr_number          INTEGER REFERENCES tbl_slv_pull_request(pr_number),
  reviewer_dev_id    TEXT,
  reviewer_login_hash TEXT,
  file_path          TEXT,
  line_no            INTEGER,
  created_at         TEXT,
  body               TEXT,
  is_bot             INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_tbl_slv_rcomment_pr ON tbl_slv_review_comment(pr_number);

CREATE TABLE IF NOT EXISTS tbl_slv_evidence_unit (
  evidence_id       TEXT PRIMARY KEY,
  dev_id            TEXT NOT NULL REFERENCES tbl_slv_developer(dev_id),
  role              TEXT NOT NULL DEFAULT 'author',   -- 'author' | 'reviewer'
  issue_key         TEXT,
  n_commits         INTEGER,
  n_files           INTEGER,
  n_chars           INTEGER,
  has_code          INTEGER DEFAULT 0,
  has_review        INTEGER DEFAULT 0,
  text_blob         TEXT,
  built_at          TEXT
);
CREATE INDEX IF NOT EXISTS ix_tbl_slv_evidence_dev ON tbl_slv_evidence_unit(dev_id);

CREATE TABLE IF NOT EXISTS tbl_slv_build_log (
  log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  step        TEXT,
  built_at    TEXT,
  params      TEXT,
  n_rows      INTEGER
);
