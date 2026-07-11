#!/usr/bin/env python3
"""ixio runs — coding-agent benchmark via mini-SWE-agent inside ConTree sandboxes.

For each (model x task): mini-SWE-agent drives the model to solve the task inside
an isolated ConTree microVM (it edits files, runs its own checks, iterates), then
we reveal the hidden test suite and score partial credit. Models route to the
right inference endpoint:
  - Anthropic (Opus 4.8, …)  -> Vercel AI Gateway   (AI_GATEWAY_API_KEY)
  - open models              -> Token Factory        (NEBIUS_API_KEY)
The sandbox itself is always ConTree (NEBIUS_API_KEY + NEBIUS_AI_PROJECT).

Reliable, unlike the hand-rolled loop — mini-SWE-agent handles the agent protocol.

  python runner/sandbox_mini.py --models anthropic/claude-opus-4-8 zai-org/GLM-5.2
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import os
import sys
import threading
from datetime import date
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run as runner  # noqa: E402

from minisweagent.environments.extra.contree import ContreeEnvironment  # noqa: E402
from minisweagent.agents.default import DefaultAgent  # noqa: E402
from minisweagent.models import get_model  # noqa: E402
from contree_sdk.config import ContreeConfig  # noqa: E402
from contree_sdk.auth import IAMAuth  # noqa: E402

os.environ.setdefault("MSWEA_COST_TRACKING", "ignore_errors")

ROOT = HERE.parent
OUT = ROOT / "web" / "src" / "data" / "ensemble-runs.json"
SANDBOX_URL = "https://api.tokenfactory.nebius.com/sandboxes/"
GATEWAY = ("https://ai-gateway.vercel.sh/v1", "AI_GATEWAY_API_KEY")
TOKENFACTORY = ("https://api.tokenfactory.nebius.com/v1", "NEBIUS_API_KEY")
HARNESS = "mini-SWE-agent"

LANG = {
    "python": ("python:3.13-slim", "pip install -q pytest", {"HOME": "/root"}),
    "typescript": ("node:20-slim", "true", {"HOME": "/root"}),
    "go": ("golang:1.23", "true", {"HOME": "/root", "GOCACHE": "/root/.cache/go-build", "GOPATH": "/root/go"}),
}

# model id -> (display name, vendor, (base_url, key_env))
MODELS = {
    "anthropic/claude-fable-5": ("Claude Fable 5", "Anthropic", GATEWAY),
    "anthropic/claude-opus-4-8": ("Claude Opus 4.8", "Anthropic", GATEWAY),
    "zai-org/GLM-5.2": ("GLM-5.2", "Z.ai", TOKENFACTORY),
    "moonshotai/Kimi-K2.6": ("Kimi K2.6", "Moonshot AI", TOKENFACTORY),
    "moonshotai/Kimi-K2.7-Code": ("Kimi K2.7 Code", "Moonshot AI", TOKENFACTORY),
    "MiniMaxAI/MiniMax-M2.5": ("MiniMax M2.5", "MiniMax", TOKENFACTORY),
    "MiniMaxAI/MiniMax-M3": ("MiniMax M3", "MiniMax", TOKENFACTORY),
    "openai/gpt-oss-120b": ("gpt-oss-120b", "OpenAI", TOKENFACTORY),
    "deepseek-ai/DeepSeek-V4-Pro": ("DeepSeek-V4", "DeepSeek", TOKENFACTORY),
    "meta-llama/Llama-3.3-70B-Instruct": ("Llama 3.3 70B", "Meta", TOKENFACTORY),
}

_CFG = yaml.safe_load((ROOT / ".venv/lib/python3.11/site-packages/minisweagent/config/default.yaml").read_text())
SYS_T, INST_T = _CFG["agent"]["system_template"], _CFG["agent"]["instance_template"]
BASE_ENV = _CFG["environment"]["env"]


class TFEnv(ContreeEnvironment):
    # ContreeEnvironment hard-codes registry creds for image import; pull public images anonymously.
    def _pull_image(self):  # noqa: ANN001
        return self.client.images.use(self.config.image)


def run_one_tenki(task, model_id: str, log) -> dict:
    """Same eval, but the sandbox is a Tenki Firecracker microVM (~2s provisioning)."""
    import tenki_env as te  # lazy: only needed for --backend tenki

    name, vendor, (base, key_env) = MODELS[model_id]
    sb = te.create_task_sandbox(task, name=f"ixio-{task.id}")
    try:
        env = te.TenkiEnvironment(sb)
        model = get_model("openai/" + model_id, config={"model_kwargs": {
            "api_key": os.environ[key_env], "api_base": base, "max_tokens": 16000,
            "tool_choice": "required", "drop_params": True}})
        agent = DefaultAgent(model, env, system_template=SYS_T, instance_template=INST_T,
                             step_limit=40, cost_limit=20.0)
        try:
            agent.run(task.prompt)
        except Exception as exc:
            log(f"    ({name} {task.id} agent: {str(exc)[:60]})")
        score = te.grade(sb, task, runner.score_from_output)
    finally:
        try:
            sb.terminate()
        except Exception:
            pass
    log(f"  {name:18} {task.id:16} -> {score * 100:5.1f}%")
    return {"model": model_id, "modelName": name, "vendor": vendor, "task": task.id, "score": score}


def run_one(task, model_id: str, log) -> dict:
    name, vendor, (base, key_env) = MODELS[model_id]
    image, setup, lenv = LANG[task.language]
    auth = IAMAuth(base_url=SANDBOX_URL, token=os.environ["NEBIUS_API_KEY"], project_id=os.environ["NEBIUS_AI_PROJECT"])
    env = TFEnv(contree_config=ContreeConfig(auth=auth), image=image, image_tag="latest",
                cwd="/work", import_username="", import_password="", env={**BASE_ENV, **lenv})
    try:
        stub = {f"/work/{p.name}": str(p) for p in task.workspace.iterdir() if p.name not in task.hidden_tests}
        env.session.run(shell=setup, files=stub, cwd="/work", env=lenv, disposable=False).wait()

        model = get_model("openai/" + model_id, config={"model_kwargs": {
            "api_key": os.environ[key_env], "api_base": base, "max_tokens": 16000,
            "tool_choice": "required", "drop_params": True}})  # force a bash tool call each turn
        agent = DefaultAgent(model, env, system_template=SYS_T, instance_template=INST_T,
                             step_limit=40, cost_limit=20.0)
        try:
            agent.run(task.prompt)
        except Exception as exc:  # agent gave up / step limit / transient — grade whatever it left
            log(f"    ({name} {task.id} agent: {str(exc)[:60]})")

        hidden = {f"/work/{n}": str(task.workspace / n) for n in task.hidden_tests}
        env.session.run(shell=task.acceptance, files=hidden, cwd="/work", env=lenv, disposable=False).wait()
        score = runner.score_from_output(task.acceptance, env.session.stdout, env.session.stderr, env.session.exit_code)
    finally:
        try:
            env.cleanup()
        except Exception:
            pass
    log(f"  {name:18} {task.id:16} -> {score * 100:5.1f}%")
    return {"model": model_id, "modelName": name, "vendor": vendor, "task": task.id, "score": score}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", default=list(MODELS))
    ap.add_argument("--tasks", nargs="*")
    ap.add_argument("--backend", choices=["contree", "tenki"], default="contree",
                    help="sandbox provider: ConTree (Token Factory) or Tenki (Firecracker)")
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--merge", action="store_true", help="merge into existing --out by (harness, model)")
    a = ap.parse_args()
    for m in a.models:
        if m not in MODELS:
            raise SystemExit(f"unknown model {m}; known: {', '.join(MODELS)}")

    tasks = [t for t in runner.discover_tasks() if t.hidden_tests and t.language in LANG]
    if a.tasks:
        tasks = [t for t in tasks if t.id in set(a.tasks)]

    lock = threading.Lock()
    def log(m):
        with lock:
            print(m, flush=True)

    jobs = [(t, mid) for mid in a.models for t in tasks]
    runner_fn = run_one_tenki if a.backend == "tenki" else run_one
    log(f"mini-SWE-agent [{a.backend}]: {len(jobs)} (model x task) across {len(a.models)} models, {len(tasks)} tasks…")
    per = []
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(runner_fn, t, mid, log): (t, mid) for (t, mid) in jobs}
        for fut in cf.as_completed(futs):
            t, mid = futs[fut]
            try:
                per.append(fut.result())
            except Exception as exc:
                log(f"  FAILED {MODELS[mid][0]} x {t.id}: {str(exc)[:120]}")
                per.append({"model": mid, "modelName": MODELS[mid][0], "vendor": MODELS[mid][1], "task": t.id, "score": None})

    # aggregate per model -> pass rate
    agg: dict[str, list] = {}
    for p in per:
        agg.setdefault(p["model"], []).append(p["score"])
    results = []
    for mid, scores in agg.items():
        ok = [s for s in scores if s is not None]
        if not ok:
            continue
        name, vendor, _ = MODELS[mid]
        results.append({"harness": HARNESS, "model": mid, "modelName": name, "modelOrg": vendor,
                        "passRate": round(1000 * sum(ok) / len(ok)) / 10, "runs": len(ok), "date": str(date.today())})

    if a.merge and Path(a.out).exists():
        prev = json.loads(Path(a.out).read_text()).get("results", [])
        merged = {(r.get("harness"), r["model"]): r for r in prev}
        for r in results:
            merged[(r["harness"], r["model"])] = r
        results = list(merged.values())

    results.sort(key=lambda r: -r["passRate"])
    Path(a.out).write_text(json.dumps({"generatedAt": str(date.today()), "harness": HARNESS, "dryRun": False,
                                       "results": results, "perTask": per}, indent=2) + "\n")
    log("\n=== per-model pass rate (mini-SWE-agent, hidden-test partial credit) ===")
    for r in results:
        log(f"  {r['passRate']:5.1f}%  {r['modelName']}")
    log(f"\nWrote {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
