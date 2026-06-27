#!/usr/bin/env node
// Generates web/src/data/leaderboard.json (SAMPLE data).
//
// Agent = Model + Harness. We rank models per harness (boards) and rank the
// harnesses themselves (agents). The runner mirrors this scoring for live runs.
//
//   node scripts/seed.mjs
//
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "web", "src", "data", "leaderboard.json");

const WEIGHTS = { passRate: 0.5, shipRate: 0.22, consistency: 0.13, cost: 0.075, speed: 0.075 };
const LANG_OFFSET = { python: 0.05, typescript: 0.0, go: -0.07 };
const CAT_OFFSET = { feature: 0.0, bugfix: 0.03, refactor: -0.05, test: 0.02 };
const CAT_TASKS = { feature: 2, bugfix: 2, refactor: 1, test: 1 };
const LANGUAGES = ["python", "typescript", "go"];
const CATEGORIES = ["feature", "bugfix", "refactor", "test"];
const TASKS_PER_LANG = 2;
const RUNS_PER_TASK = 3;

// Base model capability (harness-independent), ordered by raw coding ability.
const BASE_MODELS = [
  { id: "qwen/qwen3-coder-480b", name: "Qwen3 Coder 480B", vendor: "Alibaba", params: "480B-A35B", contextTokens: 262144, reasoning: false, pass: 0.86, ship: 0.78, cons: 0.92, turns: 11, tokens: 142000, sec: 96, priceMtok: 0.45 },
  { id: "deepseek-ai/deepseek-v3.1", name: "DeepSeek V3.1", vendor: "DeepSeek", params: "671B-A37B", contextTokens: 163840, reasoning: false, pass: 0.83, ship: 0.74, cons: 0.9, turns: 12, tokens: 158000, sec: 110, priceMtok: 0.5 },
  { id: "moonshotai/kimi-k2", name: "Kimi K2", vendor: "Moonshot AI", params: "1T-A32B", contextTokens: 131072, reasoning: false, pass: 0.81, ship: 0.72, cons: 0.88, turns: 12, tokens: 150000, sec: 121, priceMtok: 0.6 },
  { id: "zai-org/glm-4.6", name: "GLM-4.6", vendor: "Z.ai", params: "355B-A32B", contextTokens: 200000, reasoning: true, pass: 0.79, ship: 0.69, cons: 0.85, turns: 13, tokens: 171000, sec: 134, priceMtok: 0.55 },
  { id: "openai/gpt-oss-120b", name: "gpt-oss-120b", vendor: "OpenAI", params: "120B-A5.1B", contextTokens: 131072, reasoning: true, pass: 0.76, ship: 0.68, cons: 0.83, turns: 12, tokens: 119000, sec: 78, priceMtok: 0.3 },
  { id: "deepseek-ai/deepseek-r1", name: "DeepSeek R1", vendor: "DeepSeek", params: "671B-A37B", contextTokens: 163840, reasoning: true, pass: 0.74, ship: 0.6, cons: 0.8, turns: 15, tokens: 232000, sec: 205, priceMtok: 0.8 },
  { id: "qwen/qwen2.5-coder-32b", name: "Qwen2.5 Coder 32B", vendor: "Alibaba", params: "32B", contextTokens: 131072, reasoning: false, pass: 0.68, ship: 0.61, cons: 0.86, turns: 13, tokens: 121000, sec: 71, priceMtok: 0.1 },
  { id: "meta-llama/llama-3.3-70b", name: "Llama 3.3 70B", vendor: "Meta", params: "70B", contextTokens: 131072, reasoning: false, pass: 0.57, ship: 0.49, cons: 0.79, turns: 14, tokens: 138000, sec: 88, priceMtok: 0.13 },
  { id: "mistralai/devstral-small", name: "Devstral Small", vendor: "Mistral AI", params: "24B", contextTokens: 131072, reasoning: false, pass: 0.52, ship: 0.46, cons: 0.81, turns: 14, tokens: 116000, sec: 64, priceMtok: 0.08 },
  { id: "openai/gpt-oss-20b", name: "gpt-oss-20b", vendor: "OpenAI", params: "20B-A3.6B", contextTokens: 131072, reasoning: true, pass: 0.46, ship: 0.4, cons: 0.77, turns: 15, tokens: 104000, sec: 52, priceMtok: 0.05 },
];

// Harnesses. `quality` = intrinsic effectiveness; `aff` = per-vendor nudge that
// reshuffles model rankings between harnesses. Featured harnesses get full boards.
const HARNESSES = [
  { id: "claude-code", name: "Claude Code", vendor: "Anthropic", kind: "cli", cli: "claude", featured: true, quality: 0.93, openModels: true, blurb: "Anthropic's agentic CLI. Strong tool-use and long-horizon edits.", note: "Best all-round; excels with Qwen/Kimi.", aff: { Alibaba: 0.03, "Moonshot AI": 0.03 } },
  { id: "codex", name: "Codex", vendor: "OpenAI", kind: "cli", cli: "codex", featured: true, quality: 0.89, openModels: true, blurb: "OpenAI's coding agent CLI.", note: "Tuned for the gpt-oss family.", aff: { OpenAI: 0.11, DeepSeek: 0.04 } },
  { id: "gemini-cli", name: "Gemini CLI", vendor: "Google", kind: "cli", cli: "gemini", featured: true, quality: 0.84, openModels: true, blurb: "Google's open-source terminal agent.", note: "Big context; GLM and Mistral shine.", aff: { "Z.ai": 0.09, Mistral: 0.03 } },
  { id: "aider", name: "Aider", vendor: "Aider", kind: "cli", cli: "aider", featured: true, quality: 0.83, openModels: true, blurb: "Pair-programming in your terminal; repo-map aware.", note: "The classic DeepSeek pairing.", aff: { DeepSeek: 0.09, Alibaba: 0.03 } },
  { id: "opencode", name: "opencode", vendor: "SST", kind: "tui", cli: "opencode", featured: true, quality: 0.82, openModels: true, blurb: "Provider-agnostic terminal agent (TUI).", note: "Clean TUI; leans Qwen.", aff: { Alibaba: 0.07 } },
  { id: "goose", name: "Goose", vendor: "Block", kind: "cli", cli: "goose", featured: true, quality: 0.8, openModels: true, blurb: "Block's extensible on-machine agent.", note: "Extensible via MCP.", aff: { Meta: 0.06, "Moonshot AI": 0.03 } },
  { id: "openhands", name: "OpenHands", vendor: "All Hands AI", kind: "tui", cli: "openhands", featured: false, quality: 0.78, openModels: true, blurb: "Autonomous dev agent (formerly OpenDevin).", note: "Strong on multi-file features.", best: "deepseek-ai/deepseek-v3.1" },
  { id: "crush", name: "Crush", vendor: "Charm", kind: "tui", cli: "crush", featured: false, quality: 0.74, openModels: true, blurb: "Charm's glamourous coding TUI.", note: "Great UX, mid pass rates.", best: "qwen/qwen3-coder-480b" },
  { id: "copilot", name: "Copilot CLI", vendor: "GitHub", kind: "cli", cli: "copilot", featured: false, quality: 0.73, openModels: false, blurb: "GitHub's terminal agent.", note: "GitHub-hosted models only (sample).", best: "openai/gpt-oss-120b" },
  { id: "qwen-code", name: "Qwen Code", vendor: "Alibaba", kind: "cli", cli: "qwen", featured: false, quality: 0.72, openModels: true, blurb: "Qwen-tuned fork of Gemini CLI.", note: "Tuned for Qwen models.", best: "qwen/qwen3-coder-480b" },
  { id: "plandex", name: "Plandex", vendor: "Plandex", kind: "cli", cli: "plandex", featured: false, quality: 0.7, openModels: true, blurb: "Plan-first agent for large tasks.", note: "Planning helps big tasks.", best: "deepseek-ai/deepseek-v3.1" },
  { id: "pi", name: "pi", vendor: "pibase", kind: "cli", cli: "pi", featured: false, quality: 0.66, openModels: true, blurb: "Minimal scriptable coding agent.", note: "Lightweight; lower ceiling.", best: "qwen/qwen2.5-coder-32b" },
];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round = (x, n = 3) => Number(x.toFixed(n));
const pct = (x) => `${Math.round(x * 100)}%`;

function jitter(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.05; // [-0.025, 0.025]
}
function inverseNorm(values) {
  const min = Math.min(...values), max = Math.max(...values);
  return (v) => (max === min ? 1 : (max - v) / (max - min));
}
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function buildBoard(h) {
  const q = (h.quality - 0.85) * 0.6; // capability shift from harness quality
  const eff = 1 + (0.85 - h.quality) * 0.5; // worse harness → more turns/time
  const models = BASE_MODELS.map((m) => {
    const a = (h.aff?.[m.vendor] ?? 0) + jitter(h.id + m.id);
    const pass = clamp01(m.pass + q + a);
    const ship = clamp01(m.ship + q + a * 0.8);
    const cons = clamp01(m.cons + (h.quality - 0.85) * 0.3 + jitter(h.id + m.id + "c"));
    const turns = Math.round(m.turns * eff);
    const sec = Math.round(m.sec * eff);
    const tokens = Math.round(m.tokens * (1 + (eff - 1) * 0.6));
    const costPerTaskUsd = (tokens / 1e6) * m.priceMtok;
    return { ...m, pass, ship, cons, turns, sec, tokens, costPerTaskUsd };
  });

  const costScore = inverseNorm(models.map((m) => m.costPerTaskUsd));
  const speedScore = inverseNorm(models.map((m) => m.sec));

  const enriched = models.map((m) => {
    const score = 100 * (WEIGHTS.passRate * m.pass + WEIGHTS.shipRate * m.ship + WEIGHTS.consistency * m.cons + WEIGHTS.cost * costScore(m.costPerTaskUsd) + WEIGHTS.speed * speedScore(m.sec));
    const byLanguage = {};
    for (const l of LANGUAGES) byLanguage[l] = { passRate: round(clamp01(m.pass + LANG_OFFSET[l])), tasks: TASKS_PER_LANG };
    const byCategory = {};
    for (const c of CATEGORIES) byCategory[c] = { passRate: round(clamp01(m.pass + CAT_OFFSET[c])), tasks: CAT_TASKS[c] };
    return {
      id: m.id, name: m.name, vendor: m.vendor, servedBy: "Nebius Token Factory",
      params: m.params, contextTokens: m.contextTokens, openWeight: true, reasoning: m.reasoning,
      score: round(score, 1),
      metrics: { passRate: round(m.pass), shipRate: round(m.ship), consistency: round(m.cons), avgTurns: m.turns, avgTokens: m.tokens, avgDurationSec: m.sec, costPerTaskUsd: round(m.costPerTaskUsd, 4) },
      byLanguage, byCategory, runs: LANGUAGES.length * TASKS_PER_LANG * RUNS_PER_TASK,
    };
  });

  enriched.sort((a, b) => b.score - a.score);
  const n = enriched.length;
  enriched.forEach((m, i) => {
    m.rank = i + 1;
    m.tier = i / n < 0.25 ? "excellent" : i / n >= 0.6 ? "iffy" : "solid";
  });

  const bestLang = (l) => [...enriched].sort((a, b) => b.byLanguage[l].passRate - a.byLanguage[l].passRate || b.score - a.score)[0];
  const cheapest = [...enriched].filter((m) => m.metrics.passRate >= 0.55).sort((a, b) => a.metrics.costPerTaskUsd - b.metrics.costPerTaskUsd)[0] ?? enriched[0];
  const fastest = [...enriched].filter((m) => m.metrics.passRate >= 0.55).sort((a, b) => a.metrics.avgDurationSec - b.metrics.avgDurationSec)[0] ?? enriched[0];
  const steadiest = [...enriched].sort((a, b) => b.metrics.consistency - a.metrics.consistency)[0];
  const situational = [
    { id: "py", label: "Best for new Python code", blurb: "Top Python pass rate.", modelId: bestLang("python").id, metricLabel: `${pct(bestLang("python").byLanguage.python.passRate)} pass` },
    { id: "ts", label: "Best for refactoring TypeScript", blurb: "Top TypeScript pass rate.", modelId: bestLang("typescript").id, metricLabel: `${pct(bestLang("typescript").byLanguage.typescript.passRate)} pass` },
    { id: "go", label: "Best for Go services", blurb: "Top Go pass rate.", modelId: bestLang("go").id, metricLabel: `${pct(bestLang("go").byLanguage.go.passRate)} pass` },
    { id: "cheap", label: "Best on a budget", blurb: "Cheapest that still ships.", modelId: cheapest.id, metricLabel: `$${cheapest.metrics.costPerTaskUsd.toFixed(3)}/task` },
    { id: "fast", label: "Best when you're in a hurry", blurb: "Fastest capable model.", modelId: fastest.id, metricLabel: `${fastest.metrics.avgDurationSec}s/task` },
    { id: "steady", label: "Best for reproducible runs", blurb: "Most consistent on rerun.", modelId: steadiest.id, metricLabel: `${pct(steadiest.metrics.consistency)} stay` },
  ];

  return { harnessId: h.id, situational, models: enriched };
}

const boards = HARNESSES.filter((h) => h.featured).map(buildBoard);
const boardByHarness = Object.fromEntries(boards.map((b) => [b.harnessId, b]));

// Top Agent ranking (all harnesses).
const agents = HARNESSES.map((h) => {
  const board = boardByHarness[h.id];
  let bestModel, bestPass, medPass, modelsTested, score;
  if (board) {
    const scores = board.models.map((m) => m.score);
    bestModel = board.models[0];
    bestPass = bestModel.metrics.passRate;
    medPass = round(median(board.models.map((m) => m.metrics.passRate)));
    modelsTested = board.models.length;
    score = 0.5 * (h.quality * 100) + 0.3 * bestModel.score + 0.2 * median(scores);
  } else {
    // No full board (sample aggregate from intrinsic quality).
    const bm = BASE_MODELS.find((m) => m.id === h.best) ?? BASE_MODELS[0];
    bestModel = { id: bm.id, name: bm.name };
    bestPass = round(clamp01(BASE_MODELS[0].pass + (h.quality - 0.85) * 0.6));
    medPass = round(clamp01(0.62 + (h.quality - 0.78) * 0.6));
    modelsTested = 4 + Math.round(h.quality * 4);
    score = 0.5 * (h.quality * 100) + 0.3 * (h.quality * 100 * 0.92) + 0.2 * (h.quality * 100 * 0.78);
  }
  return {
    harnessId: h.id, score: round(score, 1), bestModelId: bestModel.id, bestModelName: bestModel.name,
    bestPass, medianPass: medPass, modelsTested, openModels: h.openModels, note: h.note,
  };
});
agents.sort((a, b) => b.score - a.score);
const an = agents.length;
agents.forEach((a, i) => {
  a.rank = i + 1;
  a.tier = i / an < 0.25 ? "excellent" : i / an >= 0.6 ? "iffy" : "solid";
});

const totalRuns = boards.length * BASE_MODELS.length * LANGUAGES.length * TASKS_PER_LANG * RUNS_PER_TASK;

const leaderboard = {
  meta: {
    title: "Ensemble — best models for coding agents",
    status: "sample",
    generatedAt: new Date().toISOString().slice(0, 10),
    defaultHarnessId: "claude-code",
    proxy: "https://github.com/KiranChilledOut/claude-code-proxy",
    provider: "Nebius Token Factory",
    taskSuite: { name: "ensemble-polyglot", version: "0.1.0", taskCount: LANGUAGES.length * TASKS_PER_LANG, languages: LANGUAGES },
    runsPerTask: RUNS_PER_TASK,
    totalRuns,
    notes: "SAMPLE data for layout and review. Numbers are illustrative, not measured. Run the benchmark to replace per-harness boards with live results.",
  },
  weights: WEIGHTS,
  harnesses: HARNESSES.map(({ aff, quality, ...h }) => h), // drop internal fields
  boards,
  agents,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(leaderboard, null, 2) + "\n");
console.log(`Wrote ${OUT}`);
console.log(`  ${HARNESSES.length} harnesses (${boards.length} featured boards), ${totalRuns} runs`);
console.log(`  Top agents: ${agents.slice(0, 3).map((a) => `${a.harnessId}(${a.score})`).join(", ")}`);
for (const b of boards) console.log(`  [${b.harnessId}] #1 ${b.models[0].name} (${b.models[0].score})`);
