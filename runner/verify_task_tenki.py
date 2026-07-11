#!/usr/bin/env python3
"""Pre-launch task integrity gate, executed INSIDE a Tenki microVM.

For each task id: create a sandbox, seed exactly what an agent would see,
confirm the hidden suite did not leak, then reveal it and grade the stub —
which must score ~0. The grading run happens in the same isolated environment
the eval uses, so "works on my machine" can't leak into the benchmark.

  python runner/verify_task_tenki.py py-regex-lite ts-markdown-lite go-shell-split
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run as runner  # noqa: E402
import tenki_env as te  # noqa: E402

STUB_CEILING = 0.15  # a stub scoring above this means weak/vacuous tests


def verify(task) -> bool:
    sb = te.create_task_sandbox(task, name=f"ixio-verify-{task.id}")
    try:
        seen = sb.exec("bash", "-lc", f"ls -A {te.WORK}").stdout_text.split()
        leaked = [h for h in task.hidden_tests if h in seen]
        stub = te.grade(sb, task, runner.score_from_output)
        ok = not leaked and stub <= STUB_CEILING
        print(f"  {task.id:20} agent-sees={seen} leak={leaked or 'none'} stub={stub:.3f} "
              f"{'✅ PASS' if ok else '⛔ FAIL'}")
        return ok
    finally:
        try:
            sb.terminate()
        except Exception:
            pass


def main() -> int:
    ids = set(sys.argv[1:])
    tasks = [t for t in runner.discover_tasks() if not ids or t.id in ids]
    missing = ids - {t.id for t in tasks}
    if missing:
        print(f"NOT DISCOVERED (bad task.yaml?): {', '.join(sorted(missing))}")
    print(f"Verifying {len(tasks)} task(s) in Tenki microVMs…")
    results = [verify(t) for t in tasks]
    print(f"\n{sum(results)}/{len(results)} passed the gate")
    return 0 if all(results) and not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
