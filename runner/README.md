# Ensemble runner

Benchmarks LLMs by how well they drive a **fixed** coding-agent harness
(Claude Code, headless). The harness never changes; only the underlying model
does. Models are swapped by pointing Claude Code at a local
[`claude-code-proxy`](https://github.com/KiranChilledOut/claude-codex-nebius-proxy)
instance that translates Anthropic API calls to an OpenAI-compatible endpoint
(Nebius Token Factory).

```
runner/
  run.py            # orchestrator: model x task x rerun -> RunResult -> leaderboard
  score.py          # aggregation + scoring; mirrors scripts/seed.mjs EXACTLY
  proxy.py          # start/health-check/teardown one proxy per model (context mgr)
  models.yaml       # models to benchmark + global settings
  requirements.txt  # PyYAML (everything else is stdlib)
```

## Requirements

- **Python 3.11+** and `pip install -r runner/requirements.txt` (only PyYAML).
- For **live** runs: `claude` (Claude Code) on PATH, a Go toolchain, Node ≥ 18,
  `pytest`, a Nebius API key, and the proxy (see below).
- For **dry-run**: just Python + PyYAML. No keys, no proxy, no model calls.

```sh
python3.11 -m venv .venv && . .venv/bin/activate
pip install -r runner/requirements.txt
```

## Quick start

```sh
# Dry-run: deterministic mock, zero cost, zero keys. Writes the dry-run JSON.
python runner/run.py --dry-run

# Live: needs NEBIUS_API_KEY + the proxy. Overwrites the site's seed JSON.
NEBIUS_API_KEY=sk-... python runner/run.py

# Subset of models (works in either mode):
python runner/run.py --dry-run --models qwen/qwen3-coder-480b openai/gpt-oss-20b
```

`--dry-run` is **implied** whenever `NEBIUS_API_KEY` is unset, so the full
pipeline (run → score → aggregate → JSON) always works out of the box.

## What a run does

For each model × task × `runsPerTask` reruns:

1. **Isolate** — copy `tasks/<lang>/<name>/workspace/` to a fresh temp dir.
2. **Agent** — `claude -p "<task.prompt>" --output-format json
   --dangerously-skip-permissions --max-turns <N>` in that dir, with
   `ANTHROPIC_BASE_URL` pointed at the model's proxy and `ANTHROPIC_AUTH_TOKEN`
   set. We parse `num_turns`, `total_cost_usd`, and token usage from the JSON
   result, and measure wall-clock ourselves.
3. **Acceptance** — run the task's `acceptance` command in the workspace;
   exit 0 = pass.
4. **Record** — a `RunResult` to
   `results/runs/<model_slug>/<task_id>/<attempt>.json`.

Then `score.py` aggregates all RunResults and emits the leaderboard.

## Output

| mode    | path                                          | `meta.status` |
|---------|-----------------------------------------------|---------------|
| live    | `web/src/data/leaderboard.json` (overwrites seed) | `live`     |
| dry-run | `results/leaderboard.dryrun.json` (never clobbers seed) | `sample` |

The dry-run writes to a separate path so a human can diff its **shape** against
the committed seed without overwriting it. Per-run JSON always lands under
`results/runs/`.

## Scoring (mirrors `scripts/seed.mjs`)

`score.py` reproduces the seed's formula so live and sample numbers are
comparable. Aggregated per model from RunResults:

- **passRate** — fraction of all attempts that pass.
- **shipRate** — fraction of tasks passed on the **first** attempt.
- **consistency** — fraction of tasks with identical pass/fail across that
  task's reruns (determinism).
- **avgTurns / avgTokens / avgDurationSec** — means across attempts.
- **costPerTaskUsd** — mean recorded cost per task.
- **byLanguage / byCategory** — pass rate + task count per group.

Composite **score** (0–100), identical weights to the seed:

```
score = 100 * ( 0.5 *passRate + 0.22*shipRate + 0.13*consistency
              + 0.075*costScore + 0.075*speedScore )
```

`costScore`/`speedScore` are field-wide **inverse-normalized** (lower is
better). The cost-score *input* is `avgTokens/1e6 * priceMtok` (from
`models.yaml`), matching the seed exactly. Models are ranked by score; tiers are
**top 25% → excellent**, **bottom (rank-percentile ≥ 0.6) → iffy**, else
**solid** — mirroring the seed's source thresholds. Six situational picks (best
Python / TypeScript / Go, cheapest, fastest, steadiest) use the same selection
logic as the seed.

## Dry-run mock

When mocking, each `RunResult` is synthesized **deterministically** from
`blake2b(model_id + task_id + attempt)` — no wall-clock randomness, so repeated
dry-runs are byte-identical. Per-model base ability mirrors the seed's ordering;
pass/turns/tokens/duration/cost land in believable ranges. This makes the entire
pipeline testable with zero cost and zero keys.

## The proxy (live mode)

To benchmark one model, a dedicated proxy instance is started with all model
tiers pinned to that id, on its own port (`proxyBasePort + model_index`).
`proxy.py` is a context manager: start → health-check (`GET /`) → yield base URL
→ teardown (SIGTERM, then SIGKILL).

### Environment

Confirmed against the proxy repo's `.env.example`:

| var                          | meaning                                        |
|------------------------------|------------------------------------------------|
| `OPENAI_API_KEY`             | the Nebius key (we pass `NEBIUS_API_KEY` here) |
| `OPENAI_BASE_URL`            | Nebius endpoint (`settings.nebiusBaseUrl`)     |
| `BIG_MODEL` / `MIDDLE_MODEL` / `SMALL_MODEL` / `VISION_MODEL` | all set to the model under test |
| `ANTHROPIC_API_KEY=claude-local` + `IGNORE_CLIENT_API_KEY=true` | accept the local token Claude Code sends |
| `HOST` / `PORT`              | proxy bind host/port                           |

> Note: the `.env.example` default `OPENAI_BASE_URL` is
> `https://api.tokenfactory.nebius.com/v1`. `models.yaml` uses
> `https://api.studio.nebius.com/v1` per the project brief — set
> `settings.nebiusBaseUrl` to whichever your account uses.

### Runner env vars

| var                  | purpose                                                            |
|----------------------|--------------------------------------------------------------------|
| `NEBIUS_API_KEY`     | Nebius key. **Unset ⇒ dry-run.** Passed to the proxy as `OPENAI_API_KEY`. |
| `ENSEMBLE_PROXY_CMD` | how to launch the proxy. Default `claude-code-proxy` (assumes the proxy repo is installed / on PATH). |

If the proxy isn't on PATH, point `ENSEMBLE_PROXY_CMD` at it, e.g.:

```sh
# cloned alongside this repo and run via its module / script:
ENSEMBLE_PROXY_CMD="python /path/to/claude-codex-nebius-proxy/server.py" \
NEBIUS_API_KEY=sk-... python runner/run.py
```

## Adding models / tasks

- **Models:** add an entry to `models.yaml` (`id`, `name`, `vendor`, `params`,
  `contextTokens`, `reasoning`, `priceMtok`).
- **Tasks:** drop a new `tasks/<lang>/<name>/` with `task.yaml` + `workspace/`.
  They're auto-discovered — no registry. See `tasks/README.md`.
