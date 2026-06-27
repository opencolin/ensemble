"""claude-code-proxy lifecycle management.

The proxy (https://github.com/KiranChilledOut/claude-codex-nebius-proxy, formerly
https://github.com/KiranChilledOut/claude-code-proxy) bridges Claude Code's
Anthropic API calls to OpenAI-compatible endpoints (Nebius Token Factory). To
benchmark ONE model we start a dedicated proxy instance with all three model
tiers (BIG/MIDDLE/SMALL) pinned to that model id, on its own port, then point
Claude Code at it via ANTHROPIC_BASE_URL.

Env var names below are confirmed against the proxy repo's `.env.example`:
    OPENAI_API_KEY      the Nebius key
    OPENAI_BASE_URL     e.g. https://api.studio.nebius.com/v1
    BIG_MODEL / MIDDLE_MODEL / SMALL_MODEL   model routing (all set to one id)
    ANTHROPIC_API_KEY=claude-local + IGNORE_CLIENT_API_KEY=true   accept local token
    HOST / PORT
"""

from __future__ import annotations

import contextlib
import os
import shlex
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Iterator

# The local token Claude Code sends; the proxy ignores its value when
# IGNORE_CLIENT_API_KEY=true but still requires *a* token to be present.
LOCAL_AUTH_TOKEN = "claude-local"

# How the proxy is launched. Overridable so the operator can point at a cloned
# repo, a wrapper script, or an entry already on PATH. Default assumes the proxy
# repo exposes a runnable module / console-script named below.
DEFAULT_PROXY_CMD = "claude-code-proxy"


@dataclass(frozen=True)
class ProxyConfig:
    model_id: str
    port: int
    nebius_api_key: str
    nebius_base_url: str
    host: str = "127.0.0.1"
    # Seconds to wait for the proxy to answer a health check before giving up.
    startup_timeout: float = 30.0


def _proxy_command() -> list[str]:
    """Resolve the proxy launch command from ENSEMBLE_PROXY_CMD (or default)."""
    raw = os.environ.get("ENSEMBLE_PROXY_CMD", DEFAULT_PROXY_CMD)
    return shlex.split(raw)


def _proxy_env(cfg: ProxyConfig) -> dict[str, str]:
    """Build the environment for the proxy subprocess for a single model."""
    env = dict(os.environ)
    env.update(
        {
            "OPENAI_API_KEY": cfg.nebius_api_key,
            "OPENAI_BASE_URL": cfg.nebius_base_url,
            # Pin every tier to the one model under test.
            "BIG_MODEL": cfg.model_id,
            "MIDDLE_MODEL": cfg.model_id,
            "SMALL_MODEL": cfg.model_id,
            "VISION_MODEL": cfg.model_id,
            # Accept the local token Claude Code sends regardless of its value.
            "ANTHROPIC_API_KEY": LOCAL_AUTH_TOKEN,
            "IGNORE_CLIENT_API_KEY": "true",
            "HOST": cfg.host,
            "PORT": str(cfg.port),
        }
    )
    return env


def base_url(cfg: ProxyConfig) -> str:
    return f"http://{cfg.host}:{cfg.port}"


def _is_healthy(url: str, timeout: float = 2.0) -> bool:
    """A reachable HTTP response (any status) means the server is up."""
    try:
        with urllib.request.urlopen(url, timeout=timeout):
            return True
    except urllib.error.HTTPError:
        # Server answered (e.g. 404 on "/") — it is up and listening.
        return True
    except (urllib.error.URLError, ConnectionError, OSError):
        return False


@contextlib.contextmanager
def proxy_for(cfg: ProxyConfig) -> Iterator[str]:
    """Start a proxy for one model, wait for health, yield its base URL, tear down.

    Usage:
        with proxy_for(cfg) as url:
            run_claude(base_url=url, ...)
    """
    cmd = _proxy_command()
    url = base_url(cfg)
    proc = subprocess.Popen(
        cmd,
        env=_proxy_env(cfg),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,  # own process group so we can kill children too
    )
    try:
        deadline = time.monotonic() + cfg.startup_timeout
        while True:
            if proc.poll() is not None:
                raise RuntimeError(
                    f"proxy exited early (code {proc.returncode}) starting "
                    f"{cmd!r} for model {cfg.model_id!r} on port {cfg.port}"
                )
            if _is_healthy(url):
                break
            if time.monotonic() > deadline:
                raise TimeoutError(
                    f"proxy for {cfg.model_id!r} did not become healthy within "
                    f"{cfg.startup_timeout:.0f}s at {url}"
                )
            time.sleep(0.4)
        yield url
    finally:
        _terminate(proc)


def _terminate(proc: subprocess.Popen) -> None:
    """Stop the proxy and its process group, escalating to SIGKILL if needed."""
    if proc.poll() is not None:
        return
    import signal

    with contextlib.suppress(ProcessLookupError, PermissionError):
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    try:
        proc.wait(timeout=5)
        return
    except subprocess.TimeoutExpired:
        pass
    with contextlib.suppress(ProcessLookupError, PermissionError):
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    with contextlib.suppress(subprocess.TimeoutExpired):
        proc.wait(timeout=5)
