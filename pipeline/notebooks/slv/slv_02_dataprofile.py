# Databricks notebook source
# %% [markdown]
# # SLV 02 — data profile
# Reads the silver layer and writes a single self-contained HTML page:
# what was collected, what can be read from it quantitatively and qualitatively,
# and what the data cannot show. Open the file by double-clicking it.

# %%
import sys, json, html, collections, datetime
from pathlib import Path
ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents]
            if (p / "src" / "devskill").exists())
sys.path.insert(0, str(ROOT / "src"))
from devskill.config import Config
from devskill import db

cfg = Config()
sil = db.connect(cfg.path("sqlite_silver"))
bro = db.connect(cfg.path("sqlite_bronze"))
OUT = cfg.path("sqlite_silver").parent / "data_profile.html"
LAYERS = ["frontend", "backend", "persistence", "testing", "infra_config", "i18n", "docs", "other"]
LAYER_LABEL = {"frontend": "Frontend", "backend": "Backend", "persistence": "Persistence",
               "testing": "Testing", "infra_config": "Infra/Config", "i18n": "i18n",
               "docs": "Docs", "other": "Other"}
COLORS = ["#4c78a8", "#54a24b", "#b279a2", "#e45756", "#eeca3b", "#9aa5b1", "#bab0ac", "#d7d7d7"]

esc = lambda s: html.escape(str(s) if s is not None else "")
parts = []
A = parts.append


def q(sql, args=()):
    return sil.execute(sql, args).fetchall()


def one(sql, args=()):
    return sil.execute(sql, args).fetchone()[0]


# %% --- header ------------------------------------------------------------
fetches = bro.execute("SELECT source, fetched_at, params, n_items FROM tbl_brz_fetch_log "
                      "ORDER BY log_id").fetchall()
head_sha = ""
for s, t, p, n in fetches:
    try:
        head_sha = json.loads(p).get("head", head_sha) or head_sha
    except Exception:
        pass

A(f"""<header>
<h1>Data profile — {esc(cfg.project['name'])}</h1>
<p class="sub">Observation window {esc(cfg.window['start'])} to {esc(cfg.window['end'])} ·
repository state <code>{esc(head_sha[:12])}</code> ·
generated {datetime.date.today().isoformat()}</p></header>""")

# %% --- 1 inventory -------------------------------------------------------
A('<section><h2>1 · What was collected</h2><table><tr><th>Table</th><th class="n">Rows</th>'
  '<th>Content</th></tr>')
INV = [("tbl_slv_developer", "people after merging duplicate identities"),
       ("tbl_slv_commit", "commits with author, text, issue and pull request"),
       ("tbl_slv_commit_file", "one row per changed file"),
       ("tbl_slv_commit_patch", "added lines per file, capped at 200"),
       ("tbl_slv_issue", "Jira issues with type, status, priority"),
       ("tbl_slv_issue_component", "functional components per issue"),
       ("tbl_slv_issue_comment", "discussion on issues, full text"),
       ("tbl_slv_pull_request", "pull requests with state and merge time"),
       ("tbl_slv_review", "reviews with their verdict"),
       ("tbl_slv_review_comment", "line level review comments")]
for t, d in INV:
    A(f'<tr><td><code>{t}</code></td><td class="n">{db.count(sil, t):,}</td><td>{d}</td></tr>')
A('</table>')
A('<p class="note">Every row can be traced back to the raw layer through the commit hash, '
  'the issue key or the pull request number.</p></section>')

# %% --- 2 people ----------------------------------------------------------
rows = q("""
  SELECT d.dev_id, d.n_commits, d.first_commit_at, d.last_commit_at,
    (SELECT COUNT(*) FROM tbl_slv_review v WHERE v.reviewer_dev_id=d.dev_id AND v.is_bot=0),
    (SELECT COUNT(*) FROM tbl_slv_review v JOIN tbl_slv_pull_request p ON p.pr_number=v.pr_number
       WHERE p.author_dev_id=d.dev_id AND v.is_bot=0),
    (SELECT COUNT(DISTINCT ic.component) FROM tbl_slv_commit c2
       JOIN tbl_slv_issue_component ic ON ic.issue_key=c2.issue_key WHERE c2.dev_id=d.dev_id),
    (SELECT COUNT(*) FROM tbl_slv_commit c3 WHERE c3.dev_id=d.dev_id AND c3.is_ai_assisted=1)
  FROM tbl_slv_developer d WHERE d.in_scope=1 ORDER BY d.n_commits DESC""")
A('<section><h2>2 · The people in scope</h2>')
A(f'<p>{len(rows)} people contributed at least {cfg.scope["min_commits"]} commits in the window. '
  'Bots are excluded. Volume is shown for orientation only and is never read as ability.</p>')
A('<table><tr><th>Person</th><th class="n">Commits</th><th class="n">Reviews given</th>'
  '<th class="n">Reviews received</th><th class="n">Components</th><th class="n">AI-assisted</th>'
  '<th>Active</th></tr>')
for d, nc, fa, la, rg, rr, comp, ai in rows:
    A(f'<tr><td><b>{d}</b></td><td class="n">{nc}</td><td class="n">{rg}</td>'
      f'<td class="n">{rr}</td><td class="n">{comp}</td><td class="n">{ai or ""}</td>'
      f'<td class="dim">{esc((fa or "")[:7])} – {esc((la or "")[:7])}</td></tr>')
A('</table></section>')

# %% --- 3 breadth ---------------------------------------------------------
A('<section><h2>3 · Where each person works</h2>'
  '<p>Share of changed files by layer. Translation files are shown separately because they '
  'say little about engineering skill. This is breadth, not level.</p>')
A('<div class="legend">' + "".join(
    f'<span><i style="background:{COLORS[i]}"></i>{LAYER_LABEL[l]}</span>'
    for i, l in enumerate(LAYERS)) + '</div>')
for d, *_ in rows:
    counts = dict(q("""SELECT f.layer_rule, COUNT(*) FROM tbl_slv_commit c
                       JOIN tbl_slv_commit_file f ON f.sha=c.sha
                       WHERE c.dev_id=? GROUP BY f.layer_rule""", (d,)))
    total = sum(counts.values()) or 1
    bar = ""
    x = 0.0
    for i, l in enumerate(LAYERS):
        w = 100 * counts.get(l, 0) / total
        if w > 0:
            bar += (f'<rect x="{x:.2f}%" y="0" width="{w:.2f}%" height="18" '
                    f'fill="{COLORS[i]}"><title>{LAYER_LABEL[l]}: {counts.get(l,0)} files</title></rect>')
            x += w
    A(f'<div class="row"><span class="lbl">{d}</span>'
      f'<svg class="bar" height="18" width="100%">{bar}</svg>'
      f'<span class="dim">{total} files</span></div>')
A('</section>')

# %% --- 4 review network --------------------------------------------------
pairs = q("""SELECT v.reviewer_dev_id, p.author_dev_id, COUNT(*) n
             FROM tbl_slv_review v JOIN tbl_slv_pull_request p ON p.pr_number=v.pr_number
             WHERE v.is_bot=0 AND v.reviewer_dev_id IS NOT NULL AND p.author_dev_id IS NOT NULL
               AND v.reviewer_dev_id <> p.author_dev_id
             GROUP BY 1,2 ORDER BY n DESC LIMIT 15""")
changes = q("""SELECT v.reviewer_dev_id, COUNT(*) n FROM tbl_slv_review v
               WHERE v.is_bot=0 AND v.state='CHANGES_REQUESTED' AND v.reviewer_dev_id IS NOT NULL
               GROUP BY 1 ORDER BY n DESC LIMIT 8""")
A('<section><h2>4 · Who reviews whom</h2>'
  '<p>A directed signal that company data rarely carries: reviewing someone else&rsquo;s code in an '
  'area is evidence of command over that area. Note that approvals are near automatic in this '
  'project, so a received approval means little; a requested change means a lot.</p>')
A('<div class="cols"><div><h3>Strongest review relationships</h3><table>'
  '<tr><th>Reviewer</th><th>Author</th><th class="n">Reviews</th></tr>')
for a, b, n in pairs:
    A(f'<tr><td>{a}</td><td>{b}</td><td class="n">{n}</td></tr>')
A('</table></div><div><h3>Requests changes most often</h3><table>'
  '<tr><th>Reviewer</th><th class="n">Changes requested</th></tr>')
for a, n in changes:
    A(f'<tr><td>{a}</td><td class="n">{n}</td></tr>')
A('</table></div></div></section>')

# %% --- 5 components and concentration ------------------------------------
comp_rows = q("""SELECT ic.component, COUNT(DISTINCT c.dev_id) n_dev, COUNT(*) n_commits
                 FROM tbl_slv_issue_component ic
                 JOIN tbl_slv_commit c ON c.issue_key=ic.issue_key
                 JOIN tbl_slv_developer d ON d.dev_id=c.dev_id AND d.in_scope=1
                 GROUP BY 1 HAVING n_commits >= 5 ORDER BY n_dev ASC, n_commits DESC LIMIT 14""")
A('<section><h2>5 · Functional areas and concentration</h2>'
  '<p>Components carried by a single person are both an expertise signal and an organisational '
  'risk — the question a team lead asks first.</p><table>'
  '<tr><th>Component</th><th class="n">People</th><th class="n">Commits</th><th>Assessment</th></tr>')
for c, nd, nc in comp_rows:
    tag = "single carrier" if nd == 1 else ("two people" if nd == 2 else "")
    cls = ' class="warn"' if nd <= 2 else ""
    A(f'<tr{cls}><td>{esc(c)}</td><td class="n">{nd}</td><td class="n">{nc}</td><td>{tag}</td></tr>')
A('</table></section>')

# %% --- 6 qualitative evidence --------------------------------------------
A('<section><h2>6 · Qualitative evidence</h2>'
  '<p>The material that justifies a level rather than a count. Each example carries its source so '
  'it can be checked.</p>')

A('<h3>Root cause analysis in issue discussions</h3>')
for key, dev, body in q("""SELECT ic.issue_key, ic.author_dev_id, ic.body
                           FROM tbl_slv_issue_comment ic
                           JOIN tbl_slv_developer d ON d.dev_id=ic.author_dev_id AND d.in_scope=1
                           WHERE ic.is_bot=0 AND LENGTH(ic.body) BETWEEN 300 AND 1200
                           ORDER BY LENGTH(ic.body) DESC LIMIT 4"""):
    A(f'<blockquote>{esc(body[:700])}{"…" if len(body) > 700 else ""}'
      f'<cite>{dev} · {esc(key)}</cite></blockquote>')

A('<h3>Review comments that request a change</h3>')
for pr, dev, path, body in q("""SELECT rc.pr_number, rc.reviewer_dev_id, rc.file_path, rc.body
                                FROM tbl_slv_review_comment rc
                                JOIN tbl_slv_developer d ON d.dev_id=rc.reviewer_dev_id AND d.in_scope=1
                                WHERE rc.is_bot=0 AND LENGTH(rc.body) BETWEEN 120 AND 800
                                ORDER BY LENGTH(rc.body) DESC LIMIT 4"""):
    A(f'<blockquote>{esc(body[:500])}{"…" if len(body) > 500 else ""}'
      f'<cite>{dev} · pull request #{pr} · <code>{esc((path or "")[-60:])}</code></cite></blockquote>')

A('<h3>Changes that cross several modules</h3><table>'
  '<tr><th>Person</th><th class="n">Modules</th><th class="n">Files</th><th>Commit</th></tr>')
for dev, nm, nf, subj in q("""SELECT c.dev_id, COUNT(DISTINCT f.module), COUNT(*), c.subject
                              FROM tbl_slv_commit c JOIN tbl_slv_commit_file f ON f.sha=c.sha
                              JOIN tbl_slv_developer d ON d.dev_id=c.dev_id AND d.in_scope=1
                              WHERE f.layer_rule NOT IN ('i18n','docs')
                              GROUP BY c.sha HAVING COUNT(DISTINCT f.module) >= 4
                              ORDER BY 2 DESC LIMIT 6"""):
    A(f'<tr><td>{dev}</td><td class="n">{nm}</td><td class="n">{nf}</td>'
      f'<td class="dim">{esc((subj or "")[:70])}</td></tr>')
A('</table></section>')

# %% --- 7 what the data cannot show ---------------------------------------
n_appr = one("SELECT COUNT(*) FROM tbl_slv_review WHERE state='APPROVED'")
n_chg = one("SELECT COUNT(*) FROM tbl_slv_review WHERE state='CHANGES_REQUESTED'")
A('<section><h2>7 · What the data cannot show</h2><ul>'
  '<li>Collaboration style, mentoring quality, communication</li>'
  '<li>Work that leaves no trace in the repository or the issue tracker</li>'
  '<li>Contributions to other projects or in other tools</li>'
  '<li>Effort or hours — lead time is never read as effort</li>'
  '<li>Why something was done, beyond what the discussion records</li>'
  '</ul><p class="note">In this project approvals are given almost automatically ('
  + f'{n_appr} approvals against {n_chg} change requests), '
  + 'and work is dominated by bug fixing, which limits what can be said about design ability.'
  + '</p></section>')

# %% --- write -------------------------------------------------------------
CSS = """
:root{--ink:#1f2933;--dim:#6b7684;--line:#dfe3e8;--bg:#fff;--soft:#f6f8fa;--warn:#fdf1e7}
*{box-sizing:border-box}
body{margin:0;padding:40px 48px 72px;font:15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;
color:var(--ink);background:var(--bg);max-width:1100px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:18px;margin:44px 0 10px;padding-bottom:6px;
border-bottom:2px solid var(--ink)}h3{font-size:14px;margin:26px 0 8px;color:var(--dim);
text-transform:uppercase;letter-spacing:.06em}
.sub{color:var(--dim);margin:0 0 8px}code{font:13px/1.4 ui-monospace,Menlo,Consolas,monospace;
background:var(--soft);padding:1px 5px;border-radius:3px}
table{border-collapse:collapse;width:100%;margin:10px 0 4px;font-size:14px}
th{text-align:left;font-weight:600;border-bottom:1px solid var(--ink);padding:6px 10px}
td{border-bottom:1px solid var(--line);padding:6px 10px}
.n{text-align:right;font-variant-numeric:tabular-nums}
.dim{color:var(--dim)}tr.warn td{background:var(--warn)}
.note{color:var(--dim);font-size:13.5px}
.row{display:flex;align-items:center;gap:12px;margin:5px 0}
.lbl{width:70px;font-weight:600;font-size:13.5px}
.bar{flex:1;border-radius:3px;overflow:hidden;background:var(--soft)}
.legend{display:flex;flex-wrap:wrap;gap:16px;margin:14px 0 18px;font-size:13px;color:var(--dim)}
.legend i{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:6px}
.cols{display:flex;gap:40px;flex-wrap:wrap}.cols>div{flex:1;min-width:320px}
blockquote{margin:12px 0;padding:12px 16px;border-left:3px solid var(--line);background:var(--soft);
font-size:14px;white-space:pre-wrap}
cite{display:block;margin-top:8px;font-style:normal;font-size:12.5px;color:var(--dim)}
ul{margin:8px 0 8px 20px}li{margin:3px 0}
@media print{body{padding:0;max-width:none}h2{page-break-after:avoid}section{page-break-inside:avoid}}
"""
OUT.write_text(
    "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
    f"<title>Data profile — {esc(cfg.project['name'])}</title><style>{CSS}</style></head><body>"
    + "".join(parts) + "</body></html>", encoding="utf-8")
sil.close(); bro.close()
print(f"written: {OUT}")
print("Open it by double-clicking, or print it to PDF from the browser.")
