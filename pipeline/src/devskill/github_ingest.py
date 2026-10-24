"""Pull requests, reviews and review comments via the GitHub REST API.

Without a token only 60 requests per hour are allowed, with a token 5000.
Put the token into .env as GITHUB_TOKEN.
"""
from __future__ import annotations
import time, urllib.error, urllib.request, json

API = "https://api.github.com"


class GitHub:
    def __init__(self, token: str | None = None, pause: float = 0.1):
        self.token, self.pause = token, pause

    def _get(self, url: str, tries: int = 4):
        h = {"Accept": "application/vnd.github+json",
             "User-Agent": "devskill-pipeline/0.1",
             "X-GitHub-Api-Version": "2022-11-28"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        for n in range(tries):
            try:
                req = urllib.request.Request(url, headers=h)
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = json.load(r)
                    remaining = int(r.headers.get("X-RateLimit-Remaining", "1"))
                    if remaining <= 1:
                        reset = int(r.headers.get("X-RateLimit-Reset", "0"))
                        wait = max(reset - time.time(), 0) + 5
                        print(f"  rate limit reached, waiting {wait/60:.1f} minutes ...")
                        time.sleep(wait)
                    time.sleep(self.pause)
                    return data
            except urllib.error.HTTPError as e:
                if e.code in (403, 429):          # secondary rate limit
                    time.sleep(60 * (n + 1)); continue
                if e.code == 404:
                    return None
                raise
            except Exception:
                time.sleep(5 * (n + 1))
        return None

    def paginate(self, path: str, per_page: int = 100, max_pages: int = 10_000):
        page = 1
        while page <= max_pages:
            sep = "&" if "?" in path else "?"
            data = self._get(f"{API}{path}{sep}per_page={per_page}&page={page}")
            if not data:
                return
            for item in data:
                yield item
            if len(data) < per_page:
                return
            page += 1

    # --- concrete endpoints -----------------------------------------------
    def pulls(self, owner: str, repo: str, state: str = "all"):
        yield from self.paginate(f"/repos/{owner}/{repo}/pulls?state={state}"
                                 f"&sort=created&direction=desc")

    def reviews(self, owner: str, repo: str, pr: int):
        yield from self.paginate(f"/repos/{owner}/{repo}/pulls/{pr}/reviews")

    def review_comments(self, owner: str, repo: str, pr: int):
        yield from self.paginate(f"/repos/{owner}/{repo}/pulls/{pr}/comments")
