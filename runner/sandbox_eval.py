#!/usr/bin/env python3
"""Ensemble sandbox eval — run our coding tasks inside Token Factory (ConTree) sandboxes.

Each (model x task) runs in its OWN isolated microVM, in parallel:

  1. branch a per-language base image (python/node/go), upload the task stub
     (the hidden test is withheld),
  2. a minimal coding agent drives the model (Token Factory inference) one bash
     command per turn — it inspects files, writes its solution, runs its own
     checks, and iterates,
  3. reveal the hidden test, run the acceptance command, score partial credit
     (fraction of cases passed).

Because the agent never sees the hidden tests and can't iterate against them,
strong models no longer trivially ace the suite — scores spread out.

  NEBIUS_API_KEY=... NEBIUS_AI_PROJECT=... python runner/sandbox_eval.py \
      --models zai-org/GLM-5.2 moonshotai/Kimi-K2.6 MiniMaxAI/MiniMax-M2.5
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import os
import re
import sys
import threading
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run as runner  # noqa: E402  (discover_tasks, score_from_output, hidden_tests)

from contree_sdk import ContreeSync  # noqa: E402
from contree_sdk.auth import IAMAuth  # noqa: E402
from contree_sdk.config import ContreeConfig  # noqa: E402
from openai import OpenAI  # noqa: E402

ROOT = HERE.parent
OUT = ROOT / "web" / "src" / "data" / "sandbox-runs.json"
SANDBOX_URL = "https://api.tokenfactory.nebius.com/sandboxes/"
INFER_URL = "https://api.tokenfactory.nebius.com/v1/"

# Per-language (base image, one-time setup, env). The images are ConTree-pullable
# tags; env fixes tools that need $HOME (go's build cache is unset otherwise).
LANG = {
    "python": ("python:3.13-slim", "pip install -q pytest", {"HOME": "/root"}),
    "typescript": ("node:20-slim", "true", {"HOME": "/root"}),  # node:22 tags aren't in the registry
    "go": ("golang:1.23", "true", {"HOME": "/root", "GOCACHE": "/root/.cache/go-build", "GOPATH": "/root/go"}),
}

MAX_STEPS = 16
STEP_TIMEOUT = 90
GRADE_TIMEOUT = 240
MAX_TOKENS = 28000  # reasoning models spend most of this on hidden <think>; too low -> empty content
MAX_MISSES = 6      # empty/garbled replies are common for reasoning models — be forgiving

SYSTEM = """You are an automated software-engineering agent working in a Linux sandbox.

Working directory: /work (your commands run there). The task's starter files are
already in /work. Implement the solution by editing those files.

Protocol — every message you send MUST be EXACTLY ONE bash command inside a single
```bash code block, and nothing else. I run it and reply with its stdout/stderr and
exit code. Use commands to read files, write your solution (use heredocs:
`cat > file <<'EOF' ... EOF`), compile, and run your own sanity checks.

You will be graded by a hidden test suite you cannot see. Do NOT look for it or
guess its cases — implement strictly and completely to the task specification,
handling every rule and edge case it describes.

When your solution is finished and you are confident, send exactly:
```bash
echo EVAL_COMPLETE
```

The task:
{prompt}

Files in /work: {files}
"""

_BLOCK = re.compile(r"```(?:bash|sh)?\s*\n(.*?)```", re.S)


def extract_cmd(text: str) -> str | None:
    blocks = _BLOCK.findall(text or "")
    return blocks[-1].strip() if blocks else None


def sandbox_client() -> ContreeSync:
    auth = IAMAuth(base_url=SANDBOX_URL, token=os.environ["NEBIUS_API_KEY"],
                   project_id=os.environ["NEBIUS_AI_PROJECT"])
    return ContreeSync(config=ContreeConfig(auth=auth))


def agent_loop(state, task, model_id: str, oai: OpenAI, env: dict, log) -> object:
    visible = [p.name for p in sorted(task.workspace.iterdir()) if p.name not in task.hidden_tests]
    msgs = [
        {"role": "system", "content": SYSTEM.format(prompt=task.prompt, files=", ".join(visible))},
        {"role": "user", "content": "Begin. Send your first bash command."},
    ]
    misses = 0
    for step in range(MAX_STEPS):
        try:
            resp = oai.chat.completions.create(model=model_id, messages=msgs, temperature=0, max_tokens=MAX_TOKENS)
            choice = resp.choices[0]
            out = choice.message.content or ""
            fin = choice.finish_reason
        except Exception as exc:  # transient inference error — give the model another turn
            log(f"  [{model_id} {task.id}] infer error step {step}: {str(exc)[:80]}")
            misses += 1
            if misses >= MAX_MISSES:
                break
            continue
        msgs.append({"role": "assistant", "content": out or "(no content returned)"})
        cmd = extract_cmd(out)
        if not cmd:
            misses += 1
            if misses >= MAX_MISSES:
                break
            # finish_reason=="length" means it ran out of room mid-reasoning, not that it refused.
            msgs.append({"role": "user", "content": (
                "Your reply was cut off before any command. Keep your reasoning brief and send ONE ```bash code block now."
                if fin == "length" else
                "Reply with exactly ONE ```bash code block and nothing else."
            )})
            continue
        misses = 0
        if "EVAL_COMPLETE" in cmd:
            break
        try:
            r = state.run(shell=cmd, cwd="/work", env=env, timeout=STEP_TIMEOUT, disposable=False).wait()
            state = r
            obs = ((r.stdout or "") + (("\n[stderr]\n" + r.stderr) if r.stderr else "")).strip()
            msgs.append({"role": "user", "content": f"exit={r.exit_code}\n{obs[:3000] or '(no output)'}"})
        except Exception as exc:
            msgs.append({"role": "user", "content": f"command failed to run: {str(exc)[:200]}"})
    return state


def run_one(task, model_id: str, model_name: str, log) -> dict:
    image, setup, env = LANG[task.language]
    client = sandbox_client()
    base = client.images.use(image)
    stub = {f"/work/{p.name}": str(p) for p in task.workspace.iterdir() if p.name not in task.hidden_tests}
    state = base.run(shell=f"{setup} && echo SETUP_OK", files=stub, cwd="/work", env=env, disposable=False).wait()
    state = agent_loop(state, task, model_id, OpenAI(base_url=INFER_URL, api_key=os.environ["NEBIUS_API_KEY"]), env, log)
    hidden = {f"/work/{n}": str(task.workspace / n) for n in task.hidden_tests}
    g = state.run(shell=task.acceptance, files=hidden, cwd="/work", env=env, timeout=GRADE_TIMEOUT).wait()
    score = runner.score_from_output(task.acceptance, g.stdout, g.stderr, g.exit_code)
    log(f"  {model_name:16} {task.id:16} -> {score*100:5.1f}%")
    return {"model": model_id, "task": task.id, "score": score}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", required=True, help="Token Factory model ids")
    ap.add_argument("--tasks", nargs="*", help="task ids (default: all discovered)")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()

    if not os.environ.get("NEBIUS_API_KEY") or not os.environ.get("NEBIUS_AI_PROJECT"):
        raise SystemExit("Need NEBIUS_API_KEY and NEBIUS_AI_PROJECT (set in .env).")

    tasks = runner.discover_tasks()
    if a.tasks:
        tasks = [t for t in tasks if t.id in set(a.tasks)]
    tasks = [t for t in tasks if t.language in LANG and t.hidden_tests]

    lock = threading.Lock()
    def log(m):
        with lock:
            print(m, flush=True)

    # short display names from the model id tail
    name = {mid: mid.split("/")[-1] for mid in a.models}
    jobs = [(t, mid) for mid in a.models for t in tasks]
    log(f"Running {len(jobs)} (model x task) sandbox evals across {len(a.models)} models, {len(tasks)} tasks…")

    results = []
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(run_one, t, mid, name[mid], log): (t, mid) for (t, mid) in jobs}
        for fut in cf.as_completed(futs):
            t, mid = futs[fut]
            try:
                results.append(fut.result())
            except Exception as exc:
                log(f"  FAILED {name[mid]} x {t.id}: {str(exc)[:160]}")
                results.append({"model": mid, "task": t.id, "score": None})

    # aggregate per model: mean partial-credit over tasks that produced a score
    agg = {}
    for r in results:
        agg.setdefault(r["model"], []).append(r["score"])
    rows = []
    for mid, scores in agg.items():
        ok = [s for s in scores if s is not None]
        if not ok:
            continue
        rows.append({
            "model": mid, "modelName": name[mid],
            "passRate": round(1000 * sum(ok) / len(ok)) / 10,
            "tasks": len(ok), "date": str(date.today()),
        })
    rows.sort(key=lambda r: -r["passRate"])
    out = {"generatedAt": str(date.today()), "harness": "sandbox", "results": rows, "perTask": results}
    Path(a.out).write_text(json.dumps(out, indent=2) + "\n")
    log("\n=== per-model pass rate (hidden-test partial credit) ===")
    for r in rows:
        log(f"  {r['passRate']:5.1f}%  {r['modelName']}  ({r['tasks']} tasks)")
    log(f"\nWrote {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
