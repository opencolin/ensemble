#!/usr/bin/env python3
"""ConTree connectivity smoke test.

Validates a ConTree (Nebius Token Factory sandboxes) token and proves we can
spawn a disposable sandbox and read a command's exit code — the primitive the
benchmark needs.

Run:
    pip install contree-sdk            # already in ../.venv
    # Token-factory path (most common): token + Nebius project id
    export CONTREE_TOKEN=...           # ConTree JWT
    export NEBIUS_PROJECT_ID=project-...
    python scripts/contree_smoke.py

    # Token-only path: token + your contree origin
    export CONTREE_TOKEN=...
    export CONTREE_BASE_URL=https://your-contree-origin
    python scripts/contree_smoke.py

Reads .env at the repo root if present.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main() -> int:
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    token = os.environ.get("CONTREE_TOKEN")
    if not token:
        print("error: set CONTREE_TOKEN (in env or .env)", file=sys.stderr)
        return 2

    project = os.environ.get("NEBIUS_PROJECT_ID") or None
    base_url = os.environ.get("CONTREE_BASE_URL") or None

    from contree_sdk import ContreeSync
    from contree_sdk.config import ContreeConfig, IAMAuth, JWTAuth

    if project:
        kwargs = {"token": token, "project_id": project}
        if base_url:
            kwargs["base_url"] = base_url
        auth = IAMAuth(**kwargs)  # sends Authorization: Bearer + Project header
        mode = f"IAM (project={project}, base={base_url or 'token-factory default'})"
    else:
        if not base_url:
            print(
                "error: token-only mode needs CONTREE_BASE_URL, or set "
                "NEBIUS_PROJECT_ID to use the token-factory endpoint.",
                file=sys.stderr,
            )
            return 2
        auth = JWTAuth(token=token, base_url=base_url)  # Bearer only
        mode = f"JWT (base={base_url})"

    print(f"→ auth mode: {mode}")
    client = ContreeSync(config=ContreeConfig(auth=auth))

    print("→ whoami ...")
    try:
        info = client.get_token_info()
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ token rejected by ConTree: {type(exc).__name__}: {exc}", file=sys.stderr)
        print("    Likely an expired/revoked token, wrong project id, or wrong base url.", file=sys.stderr)
        return 1
    print(f"  token ok. expiration={getattr(info, 'token_expiration', '?')}")

    print("→ spawning disposable python:3.12-slim sandbox ...")
    img = client.images.use("python:3.12-slim")
    checks = [
        "python --version",
        "python -c 'print(\"branch-math\", 6*7)'",
        "python -m pytest --version || pip install -q pytest && python -m pytest --version",
    ]
    ok = True
    for cmd in checks:
        r = img.run(shell=cmd, disposable=True).wait()
        out = (r.stdout or b"")
        if isinstance(out, bytes):
            out = out.decode("utf-8", "replace")
        print(f"  [{ 'PASS' if r.exit_code == 0 else 'FAIL' }] exit={r.exit_code}  {cmd}")
        if out.strip():
            print("        " + out.strip().replace("\n", "\n        "))
        ok = ok and r.exit_code == 0

    print("\n✓ ConTree reachable — sandboxes spawn and report exit codes." if ok
          else "\n✗ Some checks failed — see above.")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
