"""Read commits from a local clone. No network, no token, complete history."""
from __future__ import annotations
import re, subprocess
from pathlib import Path

REC, FLD = "\x1e", "\x1f"
FMT = REC + FLD.join(["%H", "%P", "%an", "%ae", "%aI", "%cn", "%ce", "%cI", "%s", "%B"])
TRAILER = re.compile(r"^(co-authored-by|signed-off-by|generated-by|assisted-by|reviewed-by)\s*:\s*(.+)$",
                     re.I | re.M)


def clone_or_update(repo_url: str, repo_path: str | Path) -> Path:
    p = Path(repo_path)
    if (p / ".git").exists():
        subprocess.run(["git", "-C", str(p), "fetch", "--all", "--quiet"], check=False)
    else:
        p.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--filter=blob:none", "--no-checkout",
                        "--quiet", repo_url, str(p)], check=True)
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
