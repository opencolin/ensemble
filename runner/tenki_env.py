"""Tenki Sandbox backend for the ixio-runs eval — mini-SWE-agent environment + helpers.

Tenki Sandbox (tenki.cloud) = disposable Firecracker microVMs: ~2s provisioning,
Ubuntu 24.04, python3 + node preinstalled, non-root `tenki` user with a
/home/tenki workdir jail for the fs API (exec(privileged=True) for apt installs).

Auth: TENKI_API_KEY (tk_...). Sessions are created under the key's first
workspace/project unless TENKI_PROJECT_ID overrides it.
"""
from __future__ import annotations

import os
import platform
from typing import Any

from tenki_sandbox import Client, Sandbox

WORK = "/home/tenki/work"

# Per-language runtime setup on the stock Ubuntu 24.04 image. python3.12 + node24
# ship preinstalled; pytest and go come from apt. The tenki user has passwordless
# sudo — use it rather than exec(privileged=True), under which apt stalls.
LANG_SETUP = {
    "python": "sudo apt-get update -qq && sudo apt-get install -y -qq python3-pytest",
    "typescript": "true",
    "go": "sudo apt-get update -qq && sudo apt-get install -y -qq golang-go",
}


def _recursive_merge(*dicts: dict) -> dict:
    out: dict = {}
    for d in dicts:
        out.update(d)
    return out


class TenkiEnvironment:
    """mini-SWE-agent environment protocol (execute / get_template_vars / serialize)
    over one Tenki Sandbox session."""

    def __init__(self, sandbox: Sandbox, *, cwd: str = WORK, env: dict[str, str] | None = None, timeout: int = 120):
        self.sandbox = sandbox
        self.cwd = cwd
        self.env = env or {}
        self.timeout = timeout

    def execute(self, action: dict, cwd: str = "", *, timeout: int | None = None) -> dict:
        try:
            # Tenki exec drops its cwd param (commands land in $HOME) — cd explicitly.
            wd = cwd or self.cwd
            r = self.sandbox.exec(
                "bash", "-lc", f"cd {wd} && {{ {action.get('command') or ''}\n}}",
                env=self.env or None, timeout=timeout or self.timeout,
            )
            # CommandResult has no numeric exit code, only ok — 0/1 preserves the
            # only thing callers check (== 0).
            return {"output": (r.stdout_text or "") + (r.stderr_text or ""), "returncode": 0 if r.ok else 1, "exception_info": ""}
        except Exception as e:  # timeouts, dropped streams — surface, don't crash the agent loop
            return {"output": "", "returncode": -1, "exception_info": f"{type(e).__name__}: {e}"}

    def get_template_vars(self, **kwargs) -> dict[str, Any]:
        return _recursive_merge({"cwd": self.cwd, "env": self.env, "timeout": self.timeout},
                                platform.uname()._asdict(), kwargs)

    def serialize(self) -> dict:
        return {"info": {"config": {"environment": {"cwd": self.cwd, "env": self.env, "timeout": self.timeout},
                                    "environment_type": f"{self.__module__}.{type(self).__name__}"}}}


_client: Client | None = None
_project_id: str | None = None


def tenki_client() -> tuple[Client, str]:
    """Singleton client + resolved project id (TENKI_PROJECT_ID overrides discovery)."""
    global _client, _project_id
    if _client is None:
        _client = Client(auth_token=os.environ["TENKI_API_KEY"])
        _project_id = os.environ.get("TENKI_PROJECT_ID") or _client.who_am_i().workspaces[0].projects[0].id
    return _client, _project_id  # type: ignore[return-value]


def create_task_sandbox(task, name: str) -> Sandbox:
    """Session with the task's runtime installed and the visible workspace seeded."""
    client, pid = tenki_client()
    sb = client.create(name=name, project_id=pid, cpu_cores=2, memory_mb=4096, max_duration=1800)
    try:
        setup = LANG_SETUP[task.language]
        r = sb.exec("bash", "-lc", setup, timeout=300)
        if not r.ok:
            raise RuntimeError(f"runtime setup failed: {(r.stderr_text or r.stdout_text)[:200]}")
        sb.exec("bash", "-lc", f"mkdir -p {WORK}")
        for p in task.workspace.iterdir():
            if not p.is_file() or p.name in task.hidden_tests:
                continue
            sb.fs.write_bytes(f"{WORK}/{p.name}", p.read_bytes())
        return sb
    except Exception:
        sb.terminate()
        raise


def grade(sb: Sandbox, task, score_fn) -> float:
    """Reveal the hidden tests, run acceptance in WORK, return partial credit [0,1]."""
    for n in task.hidden_tests:
        sb.fs.write_bytes(f"{WORK}/{n}", (task.workspace / n).read_bytes())
    # cd explicitly — exec's cwd param is unreliable (see TenkiEnvironment.execute).
    r = sb.exec("bash", "-lc", f"cd {WORK} && {task.acceptance}", timeout=300)
    return score_fn(task.acceptance, r.stdout_text or "", r.stderr_text or "", 0 if r.ok else 1)
