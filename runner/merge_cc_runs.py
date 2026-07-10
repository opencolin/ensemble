#!/usr/bin/env python3
"""Merge all Claude Code-on-Tenki run files into the ixio-runs data.

Each runner invocation wrote per-model aggregates over ITS OWN task subset, so
merging those rows directly would let partial runs clobber full ones. Instead:
collect every per-task score across all run files (latest file wins per
(model, task)), drop failures (score=None), and recompute each model's pass
rate as the mean over the tasks it completed.

  python runner/merge_cc_runs.py            # merge + rewrite ensemble-runs.json
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = ROOT / "results" / "runs"
OUT = ROOT / "web" / "src" / "data" / "ensemble-runs.json"
HARNESS = "Claude Code"

# All files produced by claude_code_tenki.py, oldest first (later files win ties).
FILES = sorted(
    [p for p in RUNS_DIR.glob("*.json") if p.name.startswith(("claude-code-tenki", "cc-"))],
    key=lambda p: p.stat().st_mtime,
)

VENDOR = {"anthropic": "Anthropic", "openai": "OpenAI", "xai": "xAI"}

def main() -> int:
    per: dict[tuple[str, str], dict] = {}
    for f in FILES:
        try:
            data = json.loads(f.read_text())
        except Exception:
            continue
        if data.get("harness") != HARNESS:
            continue
        for p in data.get("perTask", []):
            if p.get("score") is None:
                continue  # infra failure, not a measurement
            per[(p["model"], p["task"])] = p
        print(f"  read {f.name}: {len(data.get('perTask', []))} per-task rows")

    agg: dict[str, dict] = {}
    for (mid, _task), p in per.items():
        a = agg.setdefault(mid, {"name": p["modelName"], "scores": []})
        a["scores"].append(p["score"])

    rows = []
    for mid, a in agg.items():
        n = len(a["scores"])
        rows.append({
            "harness": HARNESS, "model": mid, "modelName": a["name"],
            "modelOrg": VENDOR.get(mid.split("/")[0], None),
            "passRate": round(1000 * sum(a["scores"]) / n) / 10,
            "runs": n, "date": str(date.today()),
        })

    d = json.loads(OUT.read_text())
    keep = [r for r in d["results"] if r.get("harness") != HARNESS]
    d["results"] = keep + sorted(rows, key=lambda r: -r["passRate"])
    d["generatedAt"] = str(date.today())
    OUT.write_text(json.dumps(d, indent=2) + "\n")
    print(f"\n=== Claude Code rows (mean over completed tasks) ===")
    for r in sorted(rows, key=lambda r: -r["passRate"]):
        print(f"  {r['passRate']:5.1f}%  {r['modelName']:16} ({r['runs']} tasks)")
    print(f"Wrote {OUT} ({len(d['results'])} total rows)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
