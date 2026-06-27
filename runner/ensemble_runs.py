#!/usr/bin/env python3
"""Ensemble runs — our own (harness × model) benchmark.

Fills the cells public leaderboards don't measure: Claude Code and Codex driving
open-weight models. Writes web/src/data/ensemble-runs.json, which the site reads
as the "ensemble-runs" agent benchmark (so those gap cells turn green).

  # no key, no cost — synthesize the whole pipeline end-to-end
  python runner/ensemble_runs.py --dry-run

  # real runs (needs a Nebius Token Factory key + claude/codex on PATH)
  NEBIUS_API_KEY=tf-... python runner/ensemble_runs.py \
      --harness claude-code,codex \
      --models qwen/qwen3-coder-480b zai-org/glm-4.6 moonshotai/kimi-k2

Claude Code talks the Anthropic API, so it goes through claude-code-proxy
(Anthropic→OpenAI→Nebius). Codex already speaks OpenAI, so it points straight at
Nebius via a model-provider override — no proxy needed.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import run as runner  # noqa: E402  (task discovery, claude agent, acceptance)
import proxy as proxy_mod  # noqa: E402

ROOT = HERE.parent
OUT = ROOT / "web" / "src" / "data" / "ensemble-runs.json"


def run_codex_agent(task, workdir: Path, model_id: str, base_url: str, key: str, timeout: float) -> None:
    """Drive Codex non-interactively against a Nebius model (OpenAI-compatible)."""
    env = dict(os.environ)
    env["NEBIUS_API_KEY"] = key
    cmd = [
        "codex", "exec", task.prompt,
        "--model", model_id,
        "-c", "model_provider=nebius",
        "-c", "model_providers.nebius.name=Nebius",
        "-c", f"model_providers.nebius.base_url={base_url}",
        "-c", "model_providers.nebius.env_key=NEBIUS_API_KEY",
        "--skip-git-repo-check",
        "--dangerously-bypass-approvals-and-sandbox",
    ]
    try:
        subprocess.run(cmd, cwd=workdir, env=env, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        pass


def passrate_live(harness: str, model: dict, tasks: list, settings: dict, key: str, port: int) -> tuple[float, int]:
    runs_per = int(settings.get("runsPerTask", 3))
    timeout = float(settings.get("agentTimeoutSec", 900))
    nebius_url = settings.get("nebiusBaseUrl", "https://api.studio.nebius.com/v1")
    score_sum = 0.0  # sum of per-task fractions (partial credit), not a pass count
    total = 0

    def one(task, base_url, run_agent):
        nonlocal score_sum, total
        with tempfile.TemporaryDirectory(prefix="ensemble-ws-") as tmp:
            wd = Path(tmp)
            runner.prepare_workspace(task, wd)
            run_agent(task, wd, base_url)
            score_sum += runner.run_acceptance_score(task, wd)
            total += 1

    if harness == "claude-code":
        cfg = proxy_mod.ProxyConfig(model_id=model["id"], port=port, nebius_api_key=key, nebius_base_url=nebius_url)
        with proxy_mod.proxy_for(cfg) as base_url:
            for task in tasks:
                for _ in range(runs_per):
                    one(task, base_url, lambda t, wd, bu: runner.run_claude_agent(t, wd, bu, timeout))
    elif harness == "codex":
        for task in tasks:
            for _ in range(runs_per):
                one(task, nebius_url, lambda t, wd, bu: run_codex_agent(t, wd, model["id"], bu, key, timeout))
    else:
        raise SystemExit(f"unknown harness: {harness}")

    return (100.0 * score_sum / total if total else 0.0), total


def passrate_mock(harness: str, model: dict, n: int) -> float:
    """Deterministic, plausible pass rate (no agent calls) — for pipeline tests."""
    base = runner._seed_float("ensemble-runs", harness, model["id"])  # 0..1
    bias = 0.52 if harness == "claude-code" else 0.47
    return round(max(8.0, min(85.0, 100 * (bias + (base - 0.5) * 0.5))), 1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--harness", default="claude-code,codex")
    ap.add_argument("--models", nargs="*", help="model ids (default: all in models.yaml)")
    ap.add_argument("--tasks", nargs="*", help="task ids to run (default: all discovered)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--merge", action="store_true", help="merge into existing --out (update rows by harness×model) instead of overwriting")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()

    cfg = runner.load_config()
    settings = cfg.get("settings", {})
    catalog = {m["id"]: m for m in cfg.get("models", [])}
    model_ids = a.models or list(catalog)
    models = [catalog.get(mid, {"id": mid, "name": mid, "vendor": None}) for mid in model_ids]
    harnesses = [h.strip() for h in a.harness.split(",") if h.strip()]
    tasks = runner.discover_tasks()
    if a.tasks:
        want = set(a.tasks)
        tasks = [t for t in tasks if t.id in want]
        missing = want - {t.id for t in tasks}
        if missing:
            raise SystemExit(f"unknown task id(s): {', '.join(sorted(missing))}")

    key = os.environ.get("NEBIUS_API_KEY")
    dry = a.dry_run or not key
    if dry and not a.dry_run:
        print("NEBIUS_API_KEY unset → dry-run (synthetic).", file=sys.stderr)

    runs_per = int(settings.get("runsPerTask", 3))
    base_port = int(settings.get("proxyBasePort", 8083))
    results = []
    for mi, m in enumerate(models):
        for h in harnesses:
            try:
                if dry:
                    pr, n = passrate_mock(h, m, len(tasks) * runs_per), len(tasks) * runs_per
                else:
                    pr, n = passrate_live(h, m, tasks, settings, key, base_port + mi)
            except Exception as exc:  # one bad model shouldn't abort the run
                print(f"  {h:12} × {m['id']:34} FAILED: {exc}", file=sys.stderr)
                continue
            results.append({"harness": h, "model": m["id"], "modelName": m.get("name"),
                            "modelOrg": m.get("vendor"), "passRate": pr, "runs": n, "date": str(date.today())})
            print(f"  {h:12} × {m['id']:34} {pr:5.1f}%  ({n} runs)", flush=True)

    if a.merge and Path(a.out).exists():
        try:
            prev = json.loads(Path(a.out).read_text()).get("results", [])
        except Exception:
            prev = []
        merged = {(r["harness"], r["model"]): r for r in prev if isinstance(r, dict)}
        for r in results:
            merged[(r["harness"], r["model"])] = r
        results = list(merged.values())

    out = {"generatedAt": str(date.today()), "harness": ", ".join(harnesses), "dryRun": dry, "results": results}
    Path(a.out).write_text(json.dumps(out, indent=2) + "\n")
    print(f"\nWrote {a.out} — {len(results)} (harness × model) rows · dry_run={dry}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
