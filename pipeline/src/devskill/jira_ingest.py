"""Jira issues, comments and changelog. Anonymous read access, no token."""
from __future__ import annotations
import json, time, urllib.parse, urllib.request, urllib.error

UA = {"Accept": "application/json", "User-Agent": "devskill-pipeline/0.1"}


class Jira:
    def __init__(self, base: str, pause: float = 0.3):
        self.base, self.pause = base.rstrip("/"), pause

    def _get(self, url: str, tries: int = 3):
        for n in range(tries):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA),
                                            timeout=60) as r:
                    time.sleep(self.pause)
                    return json.load(r)
            except urllib.error.HTTPError as e:
                if e.code in (401, 403):
                    raise RuntimeError(
                        f"Access denied (HTTP {e.code}) - this instance apparently "
                        f"does not allow anonymous read access.") from e
                if e.code == 404:
                    return None
                time.sleep(3 * (n + 1))
            except Exception:
                time.sleep(3 * (n + 1))
        return None

    def issue_keys(self, project: str, start: str, end: str):
        """All issue keys in the window, via the paged search endpoint."""
        jql = (f'project={project} AND created >= "{start}" AND created <= "{end}" '
               f'ORDER BY created ASC')
        token = None
        while True:
            url = (f"{self.base}/rest/api/3/search/jql"
                   f"?jql={urllib.parse.quote(jql)}&maxResults=100&fields=key")
            if token:
                url += f"&nextPageToken={urllib.parse.quote(token)}"
            d = self._get(url)
            if not d:
                return
            for it in d.get("issues", []):
                yield it["key"]
            token = d.get("nextPageToken")
            if d.get("isLast") or not token:
                return

    def issue(self, key: str):
        """Full issue including comments and changelog."""
        return self._get(f"{self.base}/rest/api/2/issue/{key}"
                         f"?fields=*all&expand=changelog")
