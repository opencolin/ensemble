#!/usr/bin/env python3
"""ixio runs — REAL Claude Code inside Tenki microVMs, any model via the AI Gateway.

The Vercel AI Gateway speaks the native Anthropic Messages protocol
(/v1/messages) and translates it for non-Anthropic models, so the actual
Claude Code CLI can drive Fable 5 AND rival models (e.g. GPT-5.6 Sol) with no
proxy: ANTHROPIC_BASE_URL=https://ai-gateway.vercel.sh + the gateway key.

Per (model x task): fresh Tenki Firecracker microVM -> install Claude Code ->
seed the task stub (hidden tests withheld) -> `claude -p` headless run ->
reveal hidden tests -> partial-credit grade.

  python runner/claude_code_tenki.py --models anthropic/claude-fable-5 openai/gpt-5.6-sol
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import os
import shlex
import sys
import threading
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run as runner  # noqa: E402
import tenki_env as te  # noqa: E402

ROOT = HERE.parent
GATEWAY_BASE = "https://ai-gateway.vercel.sh"
HARNESS = "Claude Code"
MAX_TURNS = 30
TASK_TIMEOUT = 900

MODELS = {
    "anthropic/claude-fable-5": ("Claude Fable 5", "Anthropic"),
    "openai/gpt-5.6-sol": ("GPT-5.6 Sol", "OpenAI"),
    "anthropic/claude-opus-4-8": ("Claude Opus 4.8", "Anthropic"),
    "openai/gpt-5.5": ("GPT-5.5", "OpenAI"),
    "xai/grok-4.5": ("Grok 4.5", "xAI"),
}

INSTALL_CC = "sudo npm install -g @anthropic-ai/claude-code >/dev/null 2>&1 && claude --version"


def run_one(task, model_id: str, log) -> dict:
    name, vendor = MODELS[model_id]
    sb = te.create_task_sandbox(task, name=f"ixio-cc-{task.id}")
    try:
        r = sb.exec("bash", "-lc", INSTALL_CC, timeout=300)
        if not r.ok:
            raise RuntimeError(f"claude install failed: {(r.stderr_text or r.stdout_text)[:150]}")
        sb.fs.write_bytes(f"{te.WORK}/.ixio-prompt.txt", task.prompt.encode())
        env = " ".join([
            f"ANTHROPIC_BASE_URL={GATEWAY_BASE}",
            f"ANTHROPIC_AUTH_TOKEN={os.environ['AI_GATEWAY_API_KEY']}",
            f"ANTHROPIC_MODEL={shlex.quote(model_id)}",
            f"ANTHROPIC_SMALL_FAST_MODEL={shlex.quote(model_id)}",
            "DISABLE_AUTOUPDATER=1",
        ])
        cmd = (
            f"cd {te.WORK} && {env} claude -p \"$(cat .ixio-prompt.txt)\" "
            f"--output-format json --dangerously-skip-permissions --max-turns {MAX_TURNS} "
            f">/tmp/cc-out.json 2>/tmp/cc-err.txt; "
            f"rm -f .ixio-prompt.txt; tail -c 400 /tmp/cc-out.json /tmp/cc-err.txt"
        )
        r = sb.exec("bash", "-lc", cmd, timeout=TASK_TIMEOUT)
        tail = (r.stdout_text or "")[-400:].replace("\n", " ")
        log(f"    ({name} {task.id} cc tail: {tail[:160]})")
        score = te.grade(sb, task, runner.score_from_output)
    finally:
        try:
            sb.terminate()
        except Exception:
            pass
    log(f"  {name:16} {task.id:16} -> {score * 100:5.1f}%")
    return {"model": model_id, "modelName": name, "vendor": vendor, "task": task.id, "score": score}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", default=["anthropic/claude-fable-5", "openai/gpt-5.6-sol"])
    ap.add_argument("--tasks", nargs="*")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--out", default=str(ROOT / "results" / "runs" / "claude-code-tenki.json"))
    a = ap.parse_args()
    for m in a.models:
        if m not in MODELS:
            raise SystemExit(f"unknown model {m}; known: {', '.join(MODELS)}")
    tasks = [t for t in runner.discover_tasks() if t.hidden_tests and t.language in te.LANG_SETUP]
    if a.tasks:
        tasks = [t for t in tasks if t.id in set(a.tasks)]

    lock = threading.Lock()
    def log(m):
        with lock:
            print(m, flush=True)

    jobs = [(t, mid) for mid in a.models for t in tasks]
    log(f"Claude Code [tenki]: {len(jobs)} (model x task) across {len(a.models)} models, {len(tasks)} tasks…")
    per = []
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(run_one, t, mid, log): (t, mid) for (t, mid) in jobs}
        for fut in cf.as_completed(futs):
            t, mid = futs[fut]
            try:
                per.append(fut.result())
            except Exception as exc:
                log(f"  FAILED {MODELS[mid][0]} x {t.id}: {str(exc)[:140]}")
                per.append({"model": mid, "modelName": MODELS[mid][0], "vendor": MODELS[mid][1], "task": t.id, "score": None})

    agg: dict[str, list] = {}
    for p in per:
        agg.setdefault(p["model"], []).append(p["score"])
    results = []
    for mid, scores in agg.items():
        ok = [s for s in scores if s is not None]
        if not ok:
            continue
        name, vendor = MODELS[mid]
        results.append({"harness": HARNESS, "model": mid, "modelName": name, "modelOrg": vendor,
                        "passRate": round(1000 * sum(ok) / len(ok)) / 10, "runs": len(ok), "date": str(date.today())})
    results.sort(key=lambda r: -r["passRate"])
    Path(a.out).write_text(json.dumps({"generatedAt": str(date.today()), "harness": HARNESS,
                                       "results": results, "perTask": per}, indent=2) + "\n")
    log("\n=== Claude Code on Tenki — pass rates (hidden-test partial credit) ===")
    for r in results:
        log(f"  {r['passRate']:5.1f}%  {r['modelName']}")
    log(f"Wrote {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
