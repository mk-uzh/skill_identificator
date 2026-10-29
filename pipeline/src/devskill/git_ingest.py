"""Read commits from a local clone. No network, no token, complete history."""
from __future__ import annotations
import re, subprocess
from pathlib import Path

REC, FLD = "\x1e", "\x1f"
FMT = REC + FLD.join(["%H", "%P", "%an", "%ae", "%aI", "%cn", "%ce", "%cI", "%s", "%B"])
TRAILER = re.compile(r"^(co-authored-by|signed-off-by|generated-by|assisted-by|reviewed-by)\s*:\s*(.+)$",
                     re.I | re.M)


def clone_or_update(repo_url: str, repo_path: str | Path,
                    shallow_since: str | None = None) -> Path:
    """Clone or update the working copy.

    With shallow_since the clone carries file contents from that date on, which
    is what the patch extraction needs. Pick a date a little before the
    observation window so that boundary commits fall outside it.
    """
    p = Path(repo_path)
    if (p / ".git").exists():
        subprocess.run(["git", "-C", str(p), "fetch", "--all", "--quiet"], check=False)
        return p
    p.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["git", "clone", "--quiet"]
    if shallow_since:
        cmd.append(f"--shallow-since={shallow_since}")
    else:
        cmd += ["--filter=blob:none", "--no-checkout"]
    cmd += [repo_url, str(p)]
    subprocess.run(cmd, check=True)
    return p


def head_sha(repo_path: str | Path) -> str:
    return subprocess.run(["git", "-C", str(repo_path), "rev-parse", "HEAD"],
                          capture_output=True, text=True,
                          encoding="utf-8", errors="replace").stdout.strip()


def read_commits(repo_path: str | Path, since: str, until: str | None = None):
    """Yield one dict per commit with all fields and the list of changed files."""
    cmd = ["git", "-C", str(repo_path), "log", f"--since={since}",
           "--name-status", f"--format={FMT}"]
    if until:
        cmd.insert(4, f"--until={until}")
    out = subprocess.run(cmd, capture_output=True, text=True,
                         encoding="utf-8", errors="replace").stdout

    for chunk in out.split(REC):
        if FLD not in chunk:
            continue
        parts = chunk.split(FLD)
        if len(parts) < 10:
            continue
        (sha, parents, an, ae, ai, cn, ce, ci, subject) = parts[:9]
        rest = FLD.join(parts[9:])
        sha = sha.lstrip("\n")
        # The full message body is followed by the --name-status lines.
        lines = rest.split("\n")
        body, files, in_files = [], [], False
        for ln in lines:
            m = re.match(r"^([AMDRCT])\d*\t(.+)$", ln)
            if m:
                in_files = True
                paths = m.group(2).split("\t")
                files.append({"change_type": m.group(1),
                              "path": paths[-1],
                              "old_path": paths[0] if len(paths) > 1 else None})
            elif not in_files:
                body.append(ln)
        body_txt = "\n".join(body).strip()
        trailers = [{"key": k.lower(), "value": v.strip()}
                    for k, v in TRAILER.findall(body_txt)]
        yield {
            "sha": sha,
            "parents": parents.split(),
            "author_name": an, "author_email": ae, "authored_at": ai,
            "committer_name": cn, "committer_email": ce, "committed_at": ci,
            "subject": subject,
            "body": body_txt,
            "trailers": trailers,
            "files": files,
            "is_merge": len(parents.split()) > 1,
        }


# --- patches ---------------------------------------------------------------
# Only added lines are kept, capped per file. Generated and translation files
# carry no competence signal and are skipped.
SKIP_PATTERNS = (
    ".properties", ".po", ".pot", "package-lock.json", "yarn.lock",
    ".min.js", ".min.css", "/target/", "/node_modules/", "/dist/", "/build/",
    ".svg", ".png", ".jpg", ".gif", ".ico", ".woff", ".ttf", ".eot",
)


def skip_path(path: str) -> bool:
    p = path.lower()
    return any(s in p for s in SKIP_PATTERNS)


def read_patches(repo_path: str | Path, since: str, until: str | None = None,
                 max_lines: int = 200, max_added_per_file: int = 1000):
    """Yield (sha, file_path, added_lines, n_added, n_removed, truncated).

    Requires a clone that carries file contents (see shallow_since in conf/<project>.yaml).
    """
    # A shallow clone turns its oldest commit into a parentless root commit, whose
    # diff would be the whole source tree. Those commits are skipped; set
    # shallow_since well before the window so no real commit is affected.
    roots = set(subprocess.run(
        ["git", "-C", str(repo_path), "rev-list", "--max-parents=0", "HEAD"],
        capture_output=True, text=True, encoding="utf-8",
        errors="replace").stdout.split())

    cmd = ["git", "-C", str(repo_path), "log", f"--since={since}",
           "-p", "--unified=0", "--no-color", "--no-merges",
           "--diff-filter=ACMR", f"--format={REC}%H"]
    if until:
        cmd.insert(4, f"--until={until}")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True,
                            encoding="utf-8", errors="replace", bufsize=1)

    sha = path = None
    added: list[str] = []
    n_add = n_del = 0

    def flush():
        nonlocal added, n_add, n_del, path
        if sha and path and added and not skip_path(path) and n_add <= max_added_per_file:
            yield_val = (sha, path, "\n".join(added[:max_lines]), n_add, n_del,
                         int(n_add > max_lines))
            added, n_add, n_del, path = [], 0, 0, None
            return yield_val
        added, n_add, n_del, path = [], 0, 0, None
        return None

    for line in proc.stdout:
        line = line.rstrip("\n")
        if line.startswith(REC):
            out = flush()
            if out:
                yield out
            sha = line[1:].strip()
            if sha in roots:        # parentless boundary commit, see above
                sha = None
        elif line.startswith("diff --git "):
            out = flush()
            if out:
                yield out
            parts = line.split(" b/", 1)
            path = parts[1] if len(parts) == 2 else None
        elif line.startswith("+++") or line.startswith("---") or line.startswith("@@"):
            continue
        elif line.startswith("+") and path:
            n_add += 1
            if len(added) < max_lines:
                added.append(line[1:])
        elif line.startswith("-") and path:
            n_del += 1
    out = flush()
    if out:
        yield out
    proc.stdout.close()
    proc.wait()
