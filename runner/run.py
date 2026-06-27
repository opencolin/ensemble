#!/usr/bin/env python3
"""Ensemble benchmark orchestrator.

Holds the agent harness constant (Claude Code, headless) and swaps the
underlying model via claude-code-proxy -> Nebius Token Factory. For each model,
for each task, for `runsPerTask` reruns, it:

  1. copies the task workspace to an isolated temp dir,
  2. runs Claude Code there pointed at the model's proxy instance,
  3. runs the task's acceptance command (exit 0 == pass),
  4. records a RunResult JSON.

Finally it aggregates everything into the leaderboard via score.py.

Modes
-----
* live  : requires NEBIUS_API_KEY; starts a proxy per model and calls Claude Code.
          Writes web/src/data/leaderboard.json (status="live").
* dry-run: --dry-run OR NEBIUS_API_KEY unset. NO proxy, NO Claude Code, NO cost.
          Synthesizes deterministic RunResults (seeded by hash of
          model+task+attempt) and writes results/leaderboard.dryrun.json.

Usage
-----
    python runner/run.py --dry-run
    NEBIUS_API_KEY=... python runner/run.py            # live
    python runner/run.py --models qwen/qwen3-coder-480b # subset, live or dry
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

import yaml

import proxy as proxy_mod
import score as score_mod

ROOT = Path(__file__).resolve().parent.parent
RUNNER_DIR = ROOT / "runner"
TASKS_DIR = ROOT / "tasks"
RESULTS_DIR = ROOT / "results"
RUNS_DIR = RESULTS_DIR / "runs"
LIVE_OUT = ROOT / "web" / "src" / "data" / "leaderboard.json"
DRYRUN_OUT = RESULTS_DIR / "leaderboard.dryrun.json"
MODELS_YAML = RUNNER_DIR / "models.yaml"


# --------------------------------------------------------------------------- #
# Data types
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Task:
    id: str
    language: str
    category: str
    prompt: str
    acceptance: str
    max_turns: int
    workspace: Path
    # Filenames in workspace/ that the agent must NOT see (the hidden acceptance
    # suite). Withheld while the agent works, copied back in just before grading,
    # so the score reflects the spec — not the agent iterating against the tests.
    hidden_tests: tuple[str, ...] = ()


@dataclass(frozen=True)
class RunResult:
    model_id: str
    task_id: str
    language: str
    category: str
    attempt: int
    passed: bool
    turns: int
    tokens: int
    cost_usd: float
    duration_sec: float


# --------------------------------------------------------------------------- #
# Config + task discovery
# --------------------------------------------------------------------------- #
def load_config() -> dict[str, Any]:
    with MODELS_YAML.open() as fh:
        cfg = yaml.safe_load(fh)
    cfg.setdefault("settings", {})
    cfg.setdefault("models", [])
    return cfg


def discover_tasks() -> list[Task]:
    """Find every tasks/<lang>/<name>/task.yaml and load it."""
    tasks: list[Task] = []
    for task_yaml in sorted(TASKS_DIR.glob("*/*/task.yaml")):
        data = yaml.safe_load(task_yaml.read_text())
        workspace = task_yaml.parent / "workspace"
        if not workspace.is_dir():
            raise FileNotFoundError(f"{task_yaml}: missing workspace/ dir")
        tasks.append(
            Task(
                id=data["id"],
                language=data["language"],
                category=data["category"],
                prompt=data["prompt"],
                acceptance=data["acceptance"],
                max_turns=int(data.get("maxTurns", 30)),
                workspace=workspace,
                hidden_tests=tuple(data.get("hiddenTests", []) or ()),
            )
        )
    if not tasks:
        raise RuntimeError(f"no tasks found under {TASKS_DIR}")
    return tasks


def slug(model_id: str) -> str:
    """Filesystem-safe slug for a model id."""
    return model_id.replace("/", "__")


# --------------------------------------------------------------------------- #
# Workspace isolation + acceptance
# --------------------------------------------------------------------------- #
def prepare_workspace(task: Task, dest: Path) -> None:
    """Copy the task workspace for the agent, WITHOUT the hidden acceptance tests."""
    ignore = shutil.ignore_patterns(*task.hidden_tests) if task.hidden_tests else None
    shutil.copytree(task.workspace, dest, dirs_exist_ok=True, ignore=ignore)


def reveal_hidden_tests(task: Task, workdir: Path) -> None:
    """Copy the withheld acceptance tests into workdir, just before grading.

    Overwrites any same-named file the agent may have created, so the real
    hidden suite — never the agent's own — decides the score.
    """
    for name in task.hidden_tests:
        src = task.workspace / name
        if src.is_file():
            shutil.copy2(src, workdir / name)


def run_acceptance(task: Task, workdir: Path, timeout: float = 300.0) -> bool:
    """Run the task's acceptance command in workdir; return True iff exit 0."""
    reveal_hidden_tests(task, workdir)
    try:
        proc = subprocess.run(
            task.acceptance,
            shell=True,
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc.returncode == 0
    except subprocess.TimeoutExpired:
        return False


def _grp(m: "re.Match[str] | None") -> int:
    return int(m.group(1)) if m else 0


def score_from_output(acceptance: str, stdout: str, stderr: str, returncode: int) -> float:
    """Partial credit in [0,1] = fraction of individual test CASES that passed.

    Parses the three frameworks our tasks use (pytest, node --test, `go test
    -json`). This is what makes scores discriminate: one hard task with 40 cases
    yields 40 levels of resolution instead of a single pass/fail. Falls back to
    binary (1.0 iff exit 0) when no per-case counts can be read.
    """
    out = f"{stdout or ''}\n{stderr or ''}"
    a = acceptance.lower()
    passed = failed = 0

    if "pytest" in a:
        passed = _grp(re.search(r"(\d+) passed", out))
        failed = _grp(re.search(r"(\d+) failed", out)) + _grp(re.search(r"(\d+) error", out))
    elif "node --test" in a or "node:test" in a or "node test" in a:
        passed = _grp(re.search(r"(?:#|ℹ)\s*pass\s+(\d+)", out))
        failed = _grp(re.search(r"(?:#|ℹ)\s*fail\s+(\d+)", out))
    elif "go test" in a:
        # `-json` emits one event per test; count only leaf subtests (Test has a "/").
        for line in out.splitlines():
            s = line.strip()
            if not s.startswith("{"):
                continue
            try:
                ev = json.loads(s)
            except json.JSONDecodeError:
                continue
            if "/" not in ev.get("Test", ""):
                continue
            if ev.get("Action") == "pass":
                passed += 1
            elif ev.get("Action") == "fail":
                failed += 1

    total = passed + failed
    if total:
        return passed / total
    return 1.0 if returncode == 0 else 0.0


def run_acceptance_score(task: Task, workdir: Path, timeout: float = 300.0) -> float:
    """Run acceptance once; return the FRACTION of test cases that passed [0,1]."""
    reveal_hidden_tests(task, workdir)
    try:
        proc = subprocess.run(
            task.acceptance,
            shell=True,
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return 0.0
    return score_from_output(task.acceptance, proc.stdout, proc.stderr, proc.returncode)


# --------------------------------------------------------------------------- #
# Real agent invocation (live mode)
# --------------------------------------------------------------------------- #
def run_claude_agent(
    task: Task,
    workdir: Path,
    base_url: str,
    timeout: float,
) -> dict[str, Any]:
    """Run Claude Code headless in workdir against the proxy.

    Returns parsed metrics: {turns, tokens, cost_usd, duration_sec}. Wall-clock
    is always measured here; turns/tokens/cost are pulled from Claude Code's
    JSON result when present.
    """
    env = dict(os.environ)
    env["ANTHROPIC_BASE_URL"] = base_url
    env["ANTHROPIC_AUTH_TOKEN"] = proxy_mod.LOCAL_AUTH_TOKEN

    cmd = [
        "claude",
        "-p",
        task.prompt,
        "--output-format",
        "json",
        "--dangerously-skip-permissions",
        "--max-turns",
        str(task.max_turns),
    ]

    start = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            cwd=workdir,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        stdout = proc.stdout
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
    duration = time.monotonic() - start

    turns, tokens, cost = _parse_claude_json(stdout)
    return {
        "turns": turns,
        "tokens": tokens,
        "cost_usd": cost,
        "duration_sec": round(duration, 2),
    }


def _parse_claude_json(stdout: str) -> tuple[int, int, float]:
    """Extract num_turns, total tokens, total_cost_usd from Claude Code output.

    `claude -p --output-format json` prints a single result object. Be tolerant:
    fall back to the last JSON line if extra logging precedes it.
    """
    obj = _last_json_object(stdout)
    if obj is None:
        return 0, 0, 0.0
    turns = int(obj.get("num_turns") or 0)
    cost = float(obj.get("total_cost_usd") or 0.0)
    tokens = _extract_tokens(obj)
    return turns, tokens, cost


def _extract_tokens(obj: dict[str, Any]) -> int:
    """Sum input+output tokens from a Claude Code result object if present."""
    usage = obj.get("usage")
    if isinstance(usage, dict):
        keys = (
            "input_tokens",
            "output_tokens",
            "cache_creation_input_tokens",
            "cache_read_input_tokens",
        )
        total = sum(int(usage.get(k) or 0) for k in keys)
        if total:
            return total
    # Some versions expose a flat field.
    for k in ("total_tokens", "tokens"):
        if k in obj:
            try:
                return int(obj[k])
            except (TypeError, ValueError):
                pass
    return 0


def _last_json_object(text: str) -> dict[str, Any] | None:
    # Try whole-string first, then scan lines from the end.
    for candidate in (text, *reversed(text.splitlines())):
        candidate = candidate.strip()
        if not candidate.startswith("{"):
            continue
        try:
            obj = json.loads(candidate)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            continue
    return None


# --------------------------------------------------------------------------- #
# Mock agent (dry-run mode) — deterministic, seeded, zero cost
# --------------------------------------------------------------------------- #
def _seed_float(*parts: str) -> float:
    """Deterministic float in [0,1) from a stable hash of the parts.

    Uses blake2b (not Python's salted hash()) so results are reproducible
    across processes and machines — no wall-clock randomness.
    """
    h = hashlib.blake2b(":".join(parts).encode(), digest_size=8).digest()
    return int.from_bytes(h, "big") / float(1 << 64)


# Per-model base ability (pass probability), mirrors the seed's ordering so the
# dry-run leaderboard looks plausible. Models not listed get a default band.
_MOCK_ABILITY: dict[str, float] = {
    "qwen/qwen3-coder-480b": 0.86,
    "deepseek-ai/deepseek-v3.1": 0.83,
    "moonshotai/kimi-k2": 0.81,
    "zai-org/glm-4.6": 0.79,
    "openai/gpt-oss-120b": 0.76,
    "deepseek-ai/deepseek-r1": 0.74,
    "qwen/qwen2.5-coder-32b": 0.68,
    "meta-llama/llama-3.3-70b": 0.57,
    "mistralai/devstral-small": 0.52,
    "openai/gpt-oss-20b": 0.46,
}
_MOCK_LANG_OFFSET = {"python": 0.05, "typescript": 0.0, "go": -0.07, "rust": -0.13}
_MOCK_CAT_OFFSET = {"feature": 0.0, "bugfix": 0.03, "refactor": -0.05, "test": 0.02}


def mock_run(model: dict[str, Any], task: Task, attempt: int) -> RunResult:
    """Synthesize a believable, deterministic RunResult without any agent."""
    mid = model["id"]
    ability = _MOCK_ABILITY.get(mid, 0.6)
    p_pass = _clamp01(
        ability
        + _MOCK_LANG_OFFSET.get(task.language, 0.0)
        + _MOCK_CAT_OFFSET.get(task.category, 0.0)
    )
    passed = _seed_float(mid, task.id, str(attempt), "pass") < p_pass

    # Turns: better models finish in fewer turns; jitter is seeded.
    base_turns = 10 + (1.0 - ability) * 8
    turns = int(round(base_turns + _seed_float(mid, task.id, str(attempt), "turns") * 4))
    turns = max(1, min(turns, task.max_turns))

    # Tokens scale with turns and a per-model verbosity factor.
    verbosity = 9000 + (1.0 - ability) * 6000
    tokens = int(turns * verbosity * (0.85 + 0.3 * _seed_float(mid, task.id, str(attempt), "tok")))

    # Wall-clock seconds per task. Modeled on turns (each agent turn is a
    # round-trip of a few seconds), not raw token count, so values land in the
    # same believable band as the seed (~50-210s). Reasoning models are slower.
    sec_per_turn = 5.0 if not model.get("reasoning") else 9.0
    duration = round(
        turns * sec_per_turn * (0.8 + 0.5 * _seed_float(mid, task.id, str(attempt), "dur")),
        1,
    )

    price_mtok = float(model.get("priceMtok", 0.3))
    cost = round((tokens / 1e6) * price_mtok, 5)

    return RunResult(
        model_id=mid,
        task_id=task.id,
        language=task.language,
        category=task.category,
        attempt=attempt,
        passed=passed,
        turns=turns,
        tokens=tokens,
        cost_usd=cost,
        duration_sec=duration,
    )


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


# --------------------------------------------------------------------------- #
# Persistence
# --------------------------------------------------------------------------- #
def write_run_result(rr: RunResult) -> None:
    out = RUNS_DIR / slug(rr.model_id) / rr.task_id / f"{rr.attempt}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(asdict(rr), indent=2) + "\n")


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
def select_models(cfg: dict[str, Any], only: list[str] | None) -> list[dict[str, Any]]:
    models = cfg["models"]
    if only:
        wanted = set(only)
        models = [m for m in models if m["id"] in wanted]
        missing = wanted - {m["id"] for m in models}
        if missing:
            raise SystemExit(f"unknown model id(s): {', '.join(sorted(missing))}")
    return models


def run_live_model(
    model: dict[str, Any],
    tasks: list[Task],
    settings: dict[str, Any],
    port: int,
    nebius_key: str,
) -> list[RunResult]:
    """Start a proxy for one model and run every task/attempt against it."""
    cfg = proxy_mod.ProxyConfig(
        model_id=model["id"],
        port=port,
        nebius_api_key=nebius_key,
        nebius_base_url=settings.get(
            "nebiusBaseUrl", "https://api.studio.nebius.com/v1"
        ),
    )
    runs_per_task = int(settings.get("runsPerTask", 3))
    agent_timeout = float(settings.get("agentTimeoutSec", 900))
    results: list[RunResult] = []

    with proxy_mod.proxy_for(cfg) as base_url:
        for task in tasks:
            for attempt in range(runs_per_task):
                with tempfile.TemporaryDirectory(prefix="ensemble-ws-") as tmp:
                    workdir = Path(tmp)
                    prepare_workspace(task, workdir)
                    metrics = run_claude_agent(task, workdir, base_url, agent_timeout)
                    passed = run_acceptance(task, workdir)
                    rr = RunResult(
                        model_id=model["id"],
                        task_id=task.id,
                        language=task.language,
                        category=task.category,
                        attempt=attempt,
                        passed=passed,
                        turns=metrics["turns"],
                        tokens=metrics["tokens"],
                        cost_usd=metrics["cost_usd"],
                        duration_sec=metrics["duration_sec"],
                    )
                    write_run_result(rr)
                    results.append(rr)
                    _log_run(rr)
    return results


def run_mock_model(
    model: dict[str, Any], tasks: list[Task], settings: dict[str, Any]
) -> list[RunResult]:
    runs_per_task = int(settings.get("runsPerTask", 3))
    results: list[RunResult] = []
    for task in tasks:
        for attempt in range(runs_per_task):
            rr = mock_run(model, task, attempt)
            write_run_result(rr)
            results.append(rr)
            _log_run(rr)
    return results


def _log_run(rr: RunResult) -> None:
    mark = "PASS" if rr.passed else "FAIL"
    print(
        f"  [{mark}] {rr.model_id:<28} {rr.task_id:<22} "
        f"#{rr.attempt} turns={rr.turns:<3} tok={rr.tokens:<7} "
        f"${rr.cost_usd:.4f} {rr.duration_sec:.0f}s"
    )


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ensemble benchmark runner")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="synthesize deterministic results; no proxy, no Claude Code, no cost",
    )
    parser.add_argument(
        "--models",
        nargs="*",
        default=None,
        help="subset of model ids to run (default: all in models.yaml)",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    cfg = load_config()
    settings = cfg["settings"]
    tasks = discover_tasks()
    models = select_models(cfg, args.models)

    nebius_key = os.environ.get("NEBIUS_API_KEY", "").strip()
    dry_run = args.dry_run or not nebius_key
    reason = (
        "--dry-run requested"
        if args.dry_run
        else ("NEBIUS_API_KEY unset" if not nebius_key else "")
    )

    print(
        f"Ensemble runner: {len(models)} models x {len(tasks)} tasks x "
        f"{settings.get('runsPerTask', 3)} reruns "
        f"({'DRY-RUN: ' + reason if dry_run else 'LIVE'})"
    )

    base_port = int(settings.get("proxyBasePort", 8083))
    all_results: list[RunResult] = []
    for idx, model in enumerate(models):
        print(f"\n== {model['id']} ==")
        if dry_run:
            all_results.extend(run_mock_model(model, tasks, settings))
        else:
            all_results.extend(
                run_live_model(model, tasks, settings, base_port + idx, nebius_key)
            )

    # Aggregate + score (mirrors scripts/seed.mjs) and emit the leaderboard.
    status = "sample" if dry_run else "live"
    out_path = DRYRUN_OUT if dry_run else LIVE_OUT
    leaderboard = score_mod.build_leaderboard(
        results=[asdict(r) for r in all_results],
        models=models,
        settings=settings,
        tasks=[asdict_task(t) for t in tasks],
        status=status,
        dry_run=dry_run,
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(leaderboard, indent=2) + "\n")

    n = len(leaderboard["models"])
    print(
        f"\nWrote {out_path}\n"
        f"  {n} models, {leaderboard['meta']['totalRuns']} runs, "
        f"status={leaderboard['meta']['status']}"
    )
    if n:
        top = leaderboard["models"][0]
        bot = leaderboard["models"][-1]
        print(
            f"  #1 {top['name']} ({top['score']})  ·  "
            f"#{n} {bot['name']} ({bot['score']})"
        )
    return 0


def asdict_task(t: Task) -> dict[str, Any]:
    d = asdict(t)
    d["workspace"] = str(t.workspace)
    return d


if __name__ == "__main__":
    sys.exit(main())
