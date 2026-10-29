"""Loads conf/params.yaml and resolves paths relative to the pipeline root."""
from __future__ import annotations
import os
from pathlib import Path
import yaml

PIPELINE_ROOT = Path(__file__).resolve().parents[2]


class Config:
    def __init__(self, path: str | Path | None = None):
        if path:
            p = Path(path)
        else:
            # DEVSKILL_PROJECT=nifi selects conf/nifi.yaml; unset keeps conf/params.yaml (sakai).
            name = os.environ.get("DEVSKILL_PROJECT", "").strip().lower()
            p = PIPELINE_ROOT / "conf" / (f"{name}.yaml" if name and name != "sakai" else "params.yaml")
        with open(p, encoding="utf-8") as f:
            self.raw = yaml.safe_load(f)
        self.project = self.raw["project"]
        self.window = self.raw["window"]
        self.scope = self.raw["scope"]
        self.github = self.raw["github"]
        self.jira = self.raw["jira"]
        self._paths = self.raw["paths"]

    def path(self, key: str) -> Path:
        q = PIPELINE_ROOT / self._paths[key]
        q.parent.mkdir(parents=True, exist_ok=True)
        return q

    @property
    def repo_path(self) -> Path:
        return (PIPELINE_ROOT / self.project["repo_path"]).resolve()

    @property
    def data_root(self) -> Path:
        """Folder for project-specific local files (mapping, salt, samples). Default: data/."""
        return PIPELINE_ROOT / self.project.get("data_root", "data")

    @property
    def github_token(self) -> str | None:
        return os.environ.get(self.github.get("token_env", "GITHUB_TOKEN")) or None

    def __repr__(self) -> str:
        return (f"<Config {self.project['name']} "
                f"{self.window['start']}..{self.window['end']}>")
