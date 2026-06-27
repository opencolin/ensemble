# Ensemble

**Which model is the best coding agent?**

A leaderboard that ranks LLMs by how well they perform *as the brain of a coding agent*.
The trick: hold the **agent harness constant** (Claude Code) and **swap only the model**
underneath, using [`claude-code-proxy`](https://github.com/KiranChilledOut/claude-code-proxy)
to route Claude Code's API calls to any OpenAI-compatible endpoint on **Nebius Token Factory**.

Same agent, same tasks, same hidden acceptance tests. The only variable is the model.

```
        ┌─────────────┐   Anthropic    ┌────────────────────┐  OpenAI-compat  ┌──────────────┐
        │ Claude Code │ ─────────────▶ │ claude-code-proxy  │ ──────────────▶ │   model M    │
        │  (harness)  │   /v1/messages │  (model routing)   │   /v1/chat      │ on Nebius TF │
        └─────────────┘ ◀───────────── └────────────────────┘ ◀────────────── └──────────────┘
              │  runs in an isolated copy of each task workspace
              ▼
        ┌─────────────┐   exit 0 = pass
        │ acceptance  │ ───────────────▶  RunResult { passed, turns, tokens, cost, seconds }
        │   test      │
        └─────────────┘                         │ aggregate + score
                                                ▼
                                  web/src/data/leaderboard.json ──▶  the website
```

## Layout

| Path        | What            |
| ----------- | --------------- |
| `web/`      | Next.js leaderboard site (Vercel-ready). The deliverable. |
| `runner/`   | Python harness: spins a proxy per model, drives Claude Code headless, scores runs. |
| `tasks/`    | Polyglot coding tasks, each with a hidden acceptance test. |
| `results/`  | Raw run output. Aggregates into `web/src/data/leaderboard.json`. |
| `scripts/`  | `seed.mjs` — generates sample data and documents the scoring formula. |

The data contract lives in [`web/src/lib/types.ts`](web/src/lib/types.ts). The scoring formula
is in [`scripts/seed.mjs`](scripts/seed.mjs) and mirrored in `runner/score.py`.

## Quickstart — view the site

The site ships with **sample data** so it renders immediately.

```bash
cd web
npm install     # already done if you scaffolded here
npm run dev     # http://localhost:3000
```

Regenerate the sample data any time:

```bash
node scripts/seed.mjs
```

## Run a live benchmark

This replaces the sample data with real measurements.

1. Get a **Nebius** API key (Token Factory): https://nebius.com
2. Install and run [`claude-code-proxy`](https://github.com/KiranChilledOut/claude-codex-nebius-proxy)
   (the maintained home of the proxy). Point the runner at it via `ENSEMBLE_PROXY_CMD`.
3. Pick the models to test in `runner/models.yaml`.
4. Run:

```bash
export NEBIUS_API_KEY=sk-...
python runner/run.py            # full live benchmark → web/src/data/leaderboard.json
python runner/run.py --dry-run  # no keys, no cost: synthesizes the pipeline end-to-end
```

`meta.status` flips from `"sample"` to `"live"` and the site's banner disappears.

## Scoring

A composite 0–100 score, capability-weighted so models that actually work rank highest:

| Metric  | Weight | Meaning                                            |
| ------- | -----: | -------------------------------------------------- |
| Pass    |   50%  | Fraction of attempts that pass the acceptance test |
| Ships   |   22%  | Fraction of tasks solved on the first attempt      |
| Stays   |   13%  | Fraction of tasks with identical pass/fail on rerun (determinism) |
| Cost    |  7.5%  | USD per solved task (cheaper is better)            |
| Speed   |  7.5%  | Wall-clock per task (faster is better)             |

Tiers follow the field: top 25% **Excellent**, bottom 40% **Iffy**, the rest **Solid**.

## Credits

- Proxy: [KiranChilledOut/claude-code-proxy](https://github.com/KiranChilledOut/claude-code-proxy)
- Scoring vocabulary (Pass / Ships / Stays / Cost) inspired by [CodingAgentBench](https://codingagentbench.com/leaderboard).
