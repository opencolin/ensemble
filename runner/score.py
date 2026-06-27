"""Aggregation + scoring. Mirrors scripts/seed.mjs EXACTLY.

scripts/seed.mjs is the canonical scoring logic for the sample seed. This module
reproduces the same composite-score formula, normalization, ranking, tiering and
situational-pick selection so that live results and the sample seed are directly
comparable. The ONLY difference is the source of the metrics: seed.mjs invents
per-model numbers; here we aggregate them from recorded RunResults.

Cross-checked constants (keep in sync with seed.mjs):
    WEIGHTS = { passRate:0.5, shipRate:0.22, consistency:0.13, cost:0.075, speed:0.075 }
    tier: rank-percentile < 0.25 -> excellent, >= 0.6 -> iffy, else solid
    cost score input = (avgTokens / 1e6) * priceMtok   (lower is better)
    speed score input = avgDurationSec                 (lower is better)
    situational cheapest/fastest filtered to metrics.passRate >= 0.6
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

# Must equal scripts/seed.mjs WEIGHTS.
WEIGHTS = {
    "passRate": 0.5,
    "shipRate": 0.22,
    "consistency": 0.13,
    "cost": 0.075,
    "speed": 0.075,
}

LANGUAGES = ["python", "typescript", "go", "rust"]
CATEGORIES = ["feature", "bugfix", "refactor", "test"]


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _round(x: float, n: int = 3) -> float:
    # Mirror JS Number(x.toFixed(n)): round-half-to-even differences are below
    # display precision; toFixed-style rounding via format is good enough and
    # matches the seed's presented values.
    return float(f"{x:.{n}f}")


def _inverse_norm(values: list[float]):
    """Lower-is-better -> [0,1]. Identical to seed.mjs inverseNorm."""
    lo, hi = min(values), max(values)

    def f(v: float) -> float:
        return 1.0 if hi == lo else (hi - v) / (hi - lo)

    return f


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


# --------------------------------------------------------------------------- #
# Aggregation: RunResult[] -> per-model raw metrics
# --------------------------------------------------------------------------- #
def aggregate_model(
    model_id: str, runs: list[dict[str, Any]]
) -> dict[str, Any] | None:
    """Aggregate one model's runs into raw metrics + per-task pass maps.

    Returns None if the model has no runs.
    """
    mine = [r for r in runs if r["model_id"] == model_id]
    if not mine:
        return None

    total = len(mine)
    passes = sum(1 for r in mine if r["passed"])

    # Group by task to compute ship rate (first attempt) and consistency.
    by_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in mine:
        by_task[r["task_id"]].append(r)

    first_pass = 0
    consistent_tasks = 0
    for _tid, rs in by_task.items():
        rs_sorted = sorted(rs, key=lambda r: r["attempt"])
        if rs_sorted[0]["passed"]:
            first_pass += 1
        outcomes = {r["passed"] for r in rs_sorted}
        if len(outcomes) == 1:  # identical pass/fail across reruns
            consistent_tasks += 1

    n_tasks = len(by_task)
    pass_rate = passes / total
    ship_rate = first_pass / n_tasks
    consistency = consistent_tasks / n_tasks

    avg_turns = sum(r["turns"] for r in mine) / total
    avg_tokens = sum(r["tokens"] for r in mine) / total
    avg_duration = sum(r["duration_sec"] for r in mine) / total

    # Measured per-task cost (mean recorded cost across attempts). In dry-run
    # cost_usd is synthesized; in live it comes from Claude Code's
    # total_cost_usd. For the COMPOSITE cost score we instead use the seed's
    # input (avgTokens * priceMtok) so the two leaderboards are comparable.
    measured_cost_per_task = sum(r["cost_usd"] for r in mine) / total

    # Per-language / per-category pass rate (only languages/categories present).
    by_language = _breakdown(by_task, mine, key="language")
    by_category = _breakdown(by_task, mine, key="category")

    return {
        "id": model_id,
        "runs": total,
        "passRate": pass_rate,
        "shipRate": ship_rate,
        "consistency": consistency,
        "avgTurns": avg_turns,
        "avgTokens": avg_tokens,
        "avgDurationSec": avg_duration,
        "measuredCostPerTask": measured_cost_per_task,
        "byLanguage": by_language,
        "byCategory": by_category,
    }


def _breakdown(
    by_task: dict[str, list[dict[str, Any]]],
    runs: list[dict[str, Any]],
    key: str,
) -> dict[str, dict[str, Any]]:
    """passRate over attempts + distinct task count, grouped by `key`.

    Emitted in canonical order (LANGUAGES / CATEGORIES) so the site renders the
    breakdown rows in the same order as the seed; unknown keys are appended.
    """
    attempts_by: dict[str, list[bool]] = defaultdict(list)
    tasks_by: dict[str, set[str]] = defaultdict(set)
    for r in runs:
        attempts_by[r[key]].append(bool(r["passed"]))
        tasks_by[r[key]].add(r["task_id"])

    canonical = LANGUAGES if key == "language" else CATEGORIES
    order = [k for k in canonical if k in attempts_by]
    order += [k for k in attempts_by if k not in canonical]

    out: dict[str, dict[str, Any]] = {}
    for k in order:
        results = attempts_by[k]
        out[k] = {
            "passRate": _round(sum(results) / len(results)),
            "tasks": len(tasks_by[k]),
        }
    return out


# --------------------------------------------------------------------------- #
# Composite score + ranking + tiering (mirrors seed.mjs exactly)
# --------------------------------------------------------------------------- #
def build_leaderboard(
    results: list[dict[str, Any]],
    models: list[dict[str, Any]],
    settings: dict[str, Any],
    tasks: list[dict[str, Any]],
    status: str,
    dry_run: bool,
) -> dict[str, Any]:
    served_by = settings.get("servedBy", "Nebius Token Factory")

    # Aggregate each configured model that has runs, preserving config order
    # for the cost/speed normalization field (matches seed.mjs MODELS order).
    agg: list[dict[str, Any]] = []
    model_meta: dict[str, dict[str, Any]] = {m["id"]: m for m in models}
    for m in models:
        a = aggregate_model(m["id"], results)
        if a is not None:
            agg.append(a)

    if not agg:
        raise RuntimeError("no runs to score")

    # Cost score input mirrors seed: (avgTokens / 1e6) * priceMtok. Speed input
    # is avgDurationSec. Both normalized lower-is-better across the field.
    price = {m["id"]: float(m.get("priceMtok", 0.3)) for m in models}
    cost_inputs = [(a["avgTokens"] / 1e6) * price[a["id"]] for a in agg]
    cost_score = _inverse_norm(cost_inputs)
    speed_score = _inverse_norm([a["avgDurationSec"] for a in agg])

    enriched: list[dict[str, Any]] = []
    for i, a in enumerate(agg):
        meta = model_meta[a["id"]]
        c_input = cost_inputs[i]
        c_score = cost_score(c_input)
        s_score = speed_score(a["avgDurationSec"])
        score = 100 * (
            WEIGHTS["passRate"] * a["passRate"]
            + WEIGHTS["shipRate"] * a["shipRate"]
            + WEIGHTS["consistency"] * a["consistency"]
            + WEIGHTS["cost"] * c_score
            + WEIGHTS["speed"] * s_score
        )

        # Report measured per-task cost in live mode; in dry-run the synthesized
        # cost matches the cost-score input closely. Use measured value for the
        # displayed metric either way (it is what was recorded per task).
        cost_per_task = a["measuredCostPerTask"]

        enriched.append(
            {
                "id": a["id"],
                "name": meta.get("name", a["id"]),
                "vendor": meta.get("vendor", ""),
                "servedBy": served_by,
                "params": meta.get("params", ""),
                "contextTokens": int(meta.get("contextTokens", 0)),
                "openWeight": bool(meta.get("openWeight", True)),
                "reasoning": bool(meta.get("reasoning", False)),
                "score": _round(score, 1),
                "metrics": {
                    "passRate": _round(a["passRate"]),
                    "shipRate": _round(a["shipRate"]),
                    "consistency": _round(a["consistency"]),
                    "avgTurns": _round(a["avgTurns"], 1),
                    "avgTokens": int(round(a["avgTokens"])),
                    "avgDurationSec": _round(a["avgDurationSec"], 1),
                    "costPerTaskUsd": _round(cost_per_task, 4),
                },
                "byLanguage": a["byLanguage"],
                "byCategory": a["byCategory"],
                "runs": a["runs"],
            }
        )

    # Rank + tier: identical thresholds to seed.mjs (note: code uses >= 0.6 for
    # the iffy cutoff, matching the seed source even though its comment says 40%).
    enriched.sort(key=lambda m: m["score"], reverse=True)
    n = len(enriched)
    for i, m in enumerate(enriched):
        m["rank"] = i + 1
        p = i / n
        m["tier"] = "excellent" if p < 0.25 else ("iffy" if p >= 0.6 else "solid")

    situational = _situational(enriched)

    languages_present = sorted(
        {t["language"] for t in tasks}, key=lambda x: LANGUAGES.index(x) if x in LANGUAGES else 99
    )
    total_runs = sum(m["runs"] for m in enriched)
    task_count = len({t["id"] for t in tasks})

    notes = (
        "Live benchmark: each model ran via claude-code-proxy against Nebius "
        "Token Factory; scores use the same formula as the sample seed."
        if not dry_run
        else (
            "DRY-RUN output (deterministic mock; no proxy, no model calls). "
            "Shape matches the live contract for diffing against the seed."
        )
    )

    return {
        "meta": {
            "title": "Ensemble — best models for coding agents",
            "status": status,
            "generatedAt": date.today().isoformat(),
            "harness": "Claude Code via claude-code-proxy",
            "proxy": "https://github.com/KiranChilledOut/claude-codex-nebius-proxy",
            "provider": "Nebius Token Factory",
            "taskSuite": {
                "name": "ensemble-polyglot",
                "version": "0.1.0",
                "taskCount": task_count,
                "languages": languages_present,
            },
            "runsPerTask": int(settings.get("runsPerTask", 3)),
            "totalRuns": total_runs,
            "notes": notes,
        },
        "weights": WEIGHTS,
        "situational": situational,
        "models": enriched,
    }


def _situational(enriched: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Reproduce seed.mjs situational picks, defensively (suite may omit a lang)."""

    def best_for_lang(lang: str) -> dict[str, Any] | None:
        have = [m for m in enriched if lang in m["byLanguage"]]
        if not have:
            return None
        return sorted(
            have,
            key=lambda m: (m["byLanguage"][lang]["passRate"], m["score"]),
            reverse=True,
        )[0]

    capable = lambda m: m["metrics"]["passRate"] >= 0.6  # noqa: E731
    cheapest = sorted(
        [m for m in enriched if capable(m)] or enriched,
        key=lambda m: m["metrics"]["costPerTaskUsd"],
    )[0]
    fastest = sorted(
        [m for m in enriched if capable(m)] or enriched,
        key=lambda m: m["metrics"]["avgDurationSec"],
    )[0]
    steadiest = sorted(
        enriched, key=lambda m: m["metrics"]["consistency"], reverse=True
    )[0]

    picks: list[dict[str, Any]] = []
    py = best_for_lang("python")
    ts = best_for_lang("typescript")
    go = best_for_lang("go")
    if py:
        picks.append(
            {
                "id": "py",
                "label": "Best for new Python code",
                "blurb": "Highest pass rate on Python feature tasks.",
                "modelId": py["id"],
                "metricLabel": f"{_pct(py['byLanguage']['python']['passRate'])} pass",
            }
        )
    if ts:
        picks.append(
            {
                "id": "ts",
                "label": "Best for refactoring TypeScript",
                "blurb": "Top TypeScript pass rate.",
                "modelId": ts["id"],
                "metricLabel": f"{_pct(ts['byLanguage']['typescript']['passRate'])} pass",
            }
        )
    if go:
        picks.append(
            {
                "id": "go",
                "label": "Best for Go services",
                "blurb": "Top Go pass rate.",
                "modelId": go["id"],
                "metricLabel": f"{_pct(go['byLanguage']['go']['passRate'])} pass",
            }
        )
    picks.append(
        {
            "id": "cheap",
            "label": "Best on a budget",
            "blurb": "Cheapest model that still ships real work.",
            "modelId": cheapest["id"],
            "metricLabel": f"${cheapest['metrics']['costPerTaskUsd']:.3f}/task",
        }
    )
    picks.append(
        {
            "id": "fast",
            "label": "Best when you're in a hurry",
            "blurb": "Fastest wall-clock among capable models.",
            "modelId": fastest["id"],
            "metricLabel": f"{fastest['metrics']['avgDurationSec']:.0f}s/task",
        }
    )
    picks.append(
        {
            "id": "steady",
            "label": "Best for reproducible runs",
            "blurb": "Most consistent across reruns.",
            "modelId": steadiest["id"],
            "metricLabel": f"{_pct(steadiest['metrics']['consistency'])} stay",
        }
    )
    return picks
