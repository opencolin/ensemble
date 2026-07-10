import type {
  Leaderboard, Benchmark, Harness, HarnessBoard, ModelEntry, AgentEntry,
  ModelProfile, LabEntry, ScoreCell, SourceStatus, Tier,
} from "../types";
import type { RawRecord } from "./record";
import { canonHarness, canonModel, KNOWN_HARNESSES } from "./canon";
import { fetchSweBench, SWE_BENCH_URL } from "./sources/swebench";
import { fetchTerminalBench, TERMINAL_BENCH_URL } from "./sources/terminalBench";
import { fetchCodingAgentBench, CODING_AGENT_BENCH_URL } from "./sources/codingAgentBench";
import { fetchChatbotArena, CHATBOT_ARENA_URL } from "./sources/chatbotArena";
import { fetchArenaAgent, ARENA_AGENT_URL } from "./sources/arenaAgent";
import { fetchEnsembleRuns, ENSEMBLE_RUNS_URL } from "./sources/ensembleRuns";
import { fetchStratixCup, STRATIX_CUP_URL } from "./sources/stratixCup";
import { fetchBridgeBench, BRIDGE_BENCH_URL } from "./sources/bridgeBench";

export const BENCHMARKS: Benchmark[] = [
  // Agent benchmarks: scored via a (harness, model) pair → harness boards.
  { id: "coding-agent-bench", name: "CodingAgentBench", metric: "Pass rate", kind: "agent", unit: "pct", blurb: "Open coding agents (CLIs/TUIs) across open-weight models.", source: CODING_AGENT_BENCH_URL, homepage: "https://codingagentbench.com/" },
  { id: "swe-bench", name: "SWE-bench Verified", metric: "% Resolved", kind: "model", unit: "pct", blurb: "Resolve real GitHub issues; hidden tests must pass (best per model).", source: SWE_BENCH_URL, homepage: "https://www.swebench.com/" },
  { id: "terminal-bench", name: "Terminal-Bench 2.0", metric: "Accuracy", kind: "agent", unit: "pct", blurb: "Complete real end-to-end terminal tasks.", source: TERMINAL_BENCH_URL, homepage: "https://www.tbench.ai/" },
  { id: "ensemble-runs", name: "ixio runs", metric: "Pass rate", kind: "agent", unit: "pct", blurb: "Our own runs — any harness × any model via the proxy. Fills gaps nobody else measures.", source: ENSEMBLE_RUNS_URL, homepage: ENSEMBLE_RUNS_URL },
  // Model benchmarks: scored on the raw model → model profiles + Top Team.
  { id: "arena-coding", name: "Chatbot Arena (Coding)", metric: "Coding Elo", kind: "model", unit: "elo", blurb: "Human preference Elo on coding prompts (LMArena).", source: CHATBOT_ARENA_URL, homepage: "https://lmarena.ai/" },
  { id: "artificial-analysis", name: "Artificial Analysis", metric: "Intelligence Index", kind: "model", unit: "index", blurb: "Composite intelligence index across evals.", source: CHATBOT_ARENA_URL, homepage: "https://artificialanalysis.ai/" },
  { id: "arc-agi", name: "ARC-AGI", metric: "Score", kind: "model", unit: "pct", blurb: "Abstraction & reasoning puzzles (ARC Prize).", source: CHATBOT_ARENA_URL, homepage: "https://arcprize.org/" },
  { id: "arena-agent", name: "Arena Agent", metric: "Net Improvement", kind: "model", unit: "pct", blurb: "Agentic coding eval over real sessions.", source: ARENA_AGENT_URL, homepage: "https://arena.ai/leaderboard/agent" },
  { id: "stratix-cup", name: "Stratix Cup", metric: "Tournament score", kind: "model", unit: "index", blurb: "16 frontier models write their own soccer-strategy code and compete head-to-head (LayerLens).", source: STRATIX_CUP_URL, homepage: "https://layerlens.ai/stratix-cup/season-1/" },
  { id: "bridge-bench", name: "BridgeBench", metric: "Qualified rate", kind: "model", unit: "pct", blurb: "Vibe-coding tasks (UI, debugging) measured direct from each provider's API; season rebuilt every 90 days (BridgeMind).", source: "https://github.com/bridge-mind/bridgebench", homepage: "https://bridgebench.ai" },
];

interface Src { id: string; name: string; url: string; fn: () => Promise<RawRecord[]> }
const SOURCES: Src[] = [
  { id: "coding-agent-bench", name: "CodingAgentBench", url: CODING_AGENT_BENCH_URL, fn: fetchCodingAgentBench },
  { id: "swe-bench", name: "SWE-bench", url: SWE_BENCH_URL, fn: fetchSweBench },
  { id: "terminal-bench", name: "Terminal-Bench", url: TERMINAL_BENCH_URL, fn: fetchTerminalBench },
  { id: "chatbot-arena", name: "Chatbot Arena", url: CHATBOT_ARENA_URL, fn: fetchChatbotArena },
  { id: "arena-agent", name: "Arena Agent", url: ARENA_AGENT_URL, fn: fetchArenaAgent },
  { id: "ensemble-runs", name: "ixio runs", url: ENSEMBLE_RUNS_URL, fn: fetchEnsembleRuns },
  { id: "stratix-cup", name: "Stratix Cup", url: STRATIX_CUP_URL, fn: fetchStratixCup },
  { id: "bridge-bench", name: "BridgeBench", url: BRIDGE_BENCH_URL, fn: fetchBridgeBench },
];

const round1 = (x: number) => Math.round(x * 10) / 10;
const tierOf = (i: number, n: number): Tier => (i / n < 0.25 ? "excellent" : i / n >= 0.6 ? "iffy" : "solid");
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
function percentiler(values: number[]): (v: number) => number {
  const s = [...values].sort((a, b) => a - b);
  return (v) => (s.length <= 1 ? 1 : s.filter((x) => x <= v).length / s.length);
}

export async function buildLeaderboard(scrapedAt: string): Promise<Leaderboard> {
  const settled = await Promise.allSettled(SOURCES.map((s) => s.fn()));
  const records: RawRecord[] = [];
  const sources: SourceStatus[] = SOURCES.map((s, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") {
      records.push(...r.value);
      return { id: s.id, name: s.name, url: s.url, ok: true, entries: r.value.length };
    }
    console.error(`[scrape] ${s.id} failed:`, r.reason?.message ?? r.reason);
    return { id: s.id, name: s.name, url: s.url, ok: false, entries: 0 };
  });

  // ---- canonicalize ----
  interface CRec { harnessId?: string; modelId: string; modelName: string; vendor: string; openWeight: boolean; benchmark: string; score: number; date?: string; stderr?: number; anchor?: boolean; runs?: number }
  // Models to drop from every board (e.g. announced but not actually available).
  // Empty right now — Fable 5 was excluded pre-release, reinstated once usable.
  const EXCLUDE_MODEL_IDS = new Set<string>([]);
  const harnesses = new Map<string, Harness>();
  const recs: CRec[] = records.map((r) => {
    const m = canonModel(r.modelName, r.modelOrg, r.license);
    let harnessId: string | undefined;
    if (r.benchmarkKind === "agent" && r.harnessName) {
      const h = canonHarness(r.harnessName, r.harnessOrg);
      harnessId = h.id;
      if (!harnesses.has(h.id)) harnesses.set(h.id, { id: h.id, name: h.name, vendor: h.vendor, kind: h.kind, featured: false, homepage: h.homepage });
    }
    return { harnessId, modelId: m.modelId, modelName: m.modelName, vendor: m.vendor, openWeight: m.openWeight, benchmark: r.benchmark, score: r.score, date: r.date, stderr: r.stderr, anchor: r.anchor, runs: r.runs };
  }).filter((r) => !EXCLUDE_MODEL_IDS.has(r.modelId));

  const cell = (r: CRec): ScoreCell => ({ value: r.score / 100, raw: r.score, date: r.date, stderr: r.stderr, anchor: r.anchor });

  // Per-benchmark percentile over ALL (harness, model) cells. Lets us blend
  // benchmarks of different difficulty fairly (a 60% on a hard one can beat an
  // 80% on an easy one). Used for every composite below.
  const pctByBench: Record<string, (v: number) => number> = {};
  for (const b of BENCHMARKS) pctByBench[b.id] = percentiler(recs.filter((r) => r.benchmark === b.id).map((r) => r.score));
  const blend = (scores: Record<string, ScoreCell>) => {
    const ps = Object.entries(scores).map(([bid, c]) => pctByBench[bid](c.raw));
    return ps.length ? round1((100 * ps.reduce((a, b) => a + b, 0)) / ps.length) : 0;
  };

  // ---- agent boards (per harness) ----
  const boardMap = new Map<string, Map<string, ModelEntry>>();
  for (const r of recs) {
    if (!r.harnessId) continue;
    const mm = boardMap.get(r.harnessId) ?? new Map<string, ModelEntry>();
    boardMap.set(r.harnessId, mm);
    const e = mm.get(r.modelId) ?? { modelId: r.modelId, modelName: r.modelName, vendor: r.vendor, openWeight: r.openWeight, scores: {}, composite: 0, rank: 0, tier: "solid" as Tier };
    if (!e.scores[r.benchmark] || r.score > e.scores[r.benchmark].raw) e.scores[r.benchmark] = cell(r);
    mm.set(r.modelId, e);
  }
  const boards: HarnessBoard[] = [];
  for (const [harnessId, mm] of boardMap) {
    const models = [...mm.values()];
    for (const m of models) m.composite = blend(m.scores);
    models.sort((a, b) => b.composite - a.composite);
    models.forEach((m, i) => { m.rank = i + 1; m.tier = tierOf(i, models.length); });
    const benchmarks = [...new Set(models.flatMap((m) => Object.keys(m.scores)))];
    boards.push({ harnessId, models, benchmarks });
    harnesses.get(harnessId)!.featured = models.length >= 3;
  }

  // Notable coding agents with no benchmark data yet (shown on Top Agent).
  for (const k of KNOWN_HARNESSES) {
    if (!harnesses.has(k.id)) harnesses.set(k.id, { id: k.id, name: k.name, vendor: k.vendor, kind: k.kind, featured: false, homepage: k.homepage });
  }

  // ---- Top Agent ----
  const agents: AgentEntry[] = boards.map((b) => {
    const comps = b.models.map((m) => m.composite);
    const best = b.models[0];
    return {
      harnessId: b.harnessId, rank: 0, score: round1(0.6 * best.composite + 0.4 * median(comps)), tier: "solid" as Tier,
      bestModelId: best.modelId, bestModelName: best.modelName, bestScore: best.composite,
      medianScore: round1(median(comps)), modelsTested: b.models.length, benchmarks: b.benchmarks,
    };
  });
  agents.sort((a, b) => b.score - a.score);
  agents.forEach((a, i) => { a.rank = i + 1; a.tier = tierOf(i, agents.length); });

  // Top Agent, open-weight models only (boards are sorted by composite, so filter preserves order).
  const agentsOpen: AgentEntry[] = boards
    .map((b): AgentEntry | null => {
      const open = b.models.filter((m) => m.openWeight);
      if (!open.length) return null;
      const comps = open.map((m) => m.composite);
      const best = open[0];
      return {
        harnessId: b.harnessId, rank: 0, score: round1(0.6 * best.composite + 0.4 * median(comps)), tier: "solid",
        bestModelId: best.modelId, bestModelName: best.modelName, bestScore: best.composite,
        medianScore: round1(median(comps)), modelsTested: open.length,
        benchmarks: [...new Set(open.flatMap((m) => Object.keys(m.scores)))],
      };
    })
    .filter((x): x is AgentEntry => x !== null);
  agentsOpen.sort((a, b) => b.score - a.score);
  agentsOpen.forEach((a, i) => { a.rank = i + 1; a.tier = tierOf(i, agentsOpen.length); });

  // ---- Model profiles (best score per benchmark, percentile-blended) ----
  interface MAcc { modelId: string; modelName: string; vendor: string; openWeight: boolean; scores: Record<string, { cell: ScoreCell; harnessId?: string }> }
  const macc = new Map<string, MAcc>();
  for (const r of recs) {
    const e = macc.get(r.modelId) ?? { modelId: r.modelId, modelName: r.modelName, vendor: r.vendor, openWeight: r.openWeight, scores: {} };
    macc.set(r.modelId, e);
    if (!e.scores[r.benchmark] || r.score > e.scores[r.benchmark].cell.raw) e.scores[r.benchmark] = { cell: cell(r), harnessId: r.harnessId };
  }
  const models: ModelProfile[] = [...macc.values()].map((e) => {
    const entries = Object.entries(e.scores);
    const scores: Record<string, ScoreCell> = {};
    let best: ModelProfile["best"] = null, bestPct = -1;
    for (const [bid, s] of entries) {
      scores[bid] = s.cell;
      const p = pctByBench[bid](s.cell.raw);
      if (p > bestPct) { bestPct = p; best = { benchmark: bid, raw: s.cell.raw, harnessId: s.harnessId }; }
    }
    // Evidence-weighted composite: average percentile with ONE phantom median
    // observation (Bayesian shrinkage, k=1). A perfect score on a single
    // benchmark caps at ~75, so thin evidence can't outrank broad excellence —
    // fixes e.g. a one-benchmark model at percentile 1.0 ranking #1 overall.
    const ps = Object.entries(scores).map(([bid, c]) => pctByBench[bid](c.raw));
    const composite = ps.length ? round1((100 * (ps.reduce((a, b) => a + b, 0) + 0.5)) / (ps.length + 1)) : 0;
    return { modelId: e.modelId, modelName: e.modelName, vendor: e.vendor, openWeight: e.openWeight, scores, best, composite, rank: 0, tier: "solid" as Tier };
  });
  models.sort((a, b) => b.composite - a.composite);
  models.forEach((m, i) => { m.rank = i + 1; m.tier = tierOf(i, models.length); });

  // ---- Top Labs (each lab = its best model) ----
  const byVendor = new Map<string, ModelProfile[]>();
  for (const m of models) {
    if (m.vendor === "Unknown") continue;
    (byVendor.get(m.vendor) ?? byVendor.set(m.vendor, []).get(m.vendor)!).push(m);
  }
  const labs: LabEntry[] = [...byVendor.entries()].map(([vendor, ms]) => {
    const best = ms.reduce((a, b) => (b.composite > a.composite ? b : a));
    return { vendor, rank: 0, score: best.composite, tier: "solid" as Tier, bestModelId: best.modelId, bestModelName: best.modelName, modelCount: ms.length, openWeight: best.openWeight };
  });
  labs.sort((a, b) => b.score - a.score);
  labs.forEach((l, i) => { l.rank = i + 1; l.tier = tierOf(i, labs.length); });

  // Top Team, open-weight models only (each team by its best open model).
  const byVendorOpen = new Map<string, ModelProfile[]>();
  for (const m of models) if (m.openWeight && m.vendor !== "Unknown") (byVendorOpen.get(m.vendor) ?? byVendorOpen.set(m.vendor, []).get(m.vendor)!).push(m);
  const labsOpen: LabEntry[] = [...byVendorOpen.entries()].map(([vendor, ms]) => {
    const best = ms.reduce((a, b) => (b.composite > a.composite ? b : a));
    return { vendor, rank: 0, score: best.composite, tier: "solid" as Tier, bestModelId: best.modelId, bestModelName: best.modelName, modelCount: ms.length, openWeight: true };
  });
  labsOpen.sort((a, b) => b.score - a.score);
  labsOpen.forEach((l, i) => { l.rank = i + 1; l.tier = tierOf(i, labsOpen.length); });

  // ---- Top Benchmark: rank the benchmarks themselves ----
  // Editorial rubric (agent-native / realism / openness) × data-driven coverage.
  const RUBRIC: Record<string, { agentNative: number; realism: number; openness: number }> = {
    "coding-agent-bench": { agentNative: 100, realism: 95, openness: 95 },
    "swe-bench": { agentNative: 65, realism: 100, openness: 90 },
    "terminal-bench": { agentNative: 100, realism: 95, openness: 88 },
    "ensemble-runs": { agentNative: 100, realism: 90, openness: 100 },
    "arena-agent": { agentNative: 45, realism: 80, openness: 60 },
    "arc-agi": { agentNative: 0, realism: 66, openness: 90 },
    "artificial-analysis": { agentNative: 0, realism: 72, openness: 50 },
    "arena-coding": { agentNative: 0, realism: 60, openness: 70 },
    // Model-level, but executable head-to-head where models write/iterate real code,
    // every match traced + signed — so it rates well on realism/openness for a model bench.
    "stratix-cup": { agentNative: 35, realism: 80, openness: 85 },
    // Real UI/debug coding tasks scored in a browser, direct-to-provider, open repo + tasks.
    "bridge-bench": { agentNative: 30, realism: 85, openness: 90 },
  };
  const BW = { agentNative: 0.3, coverage: 0.3, realism: 0.25, openness: 0.15 };
  const bStats = new Map<string, { entries: number; runs: number; harnesses: Set<string>; models: Set<string> }>();
  for (const r of recs) {
    const s = bStats.get(r.benchmark) ?? { entries: 0, runs: 0, harnesses: new Set<string>(), models: new Set<string>() };
    s.entries++;
    s.runs += r.runs ?? 1;
    if (r.harnessId) s.harnesses.add(r.harnessId);
    s.models.add(r.modelId);
    bStats.set(r.benchmark, s);
  }
  const activeB = BENCHMARKS.filter((b) => bStats.has(b.id));
  const maxPairs = Math.max(1, ...activeB.map((b) => (b.kind === "agent" ? bStats.get(b.id)!.entries : 0)));
  const benchmarkRanking = activeB.map((b) => {
    const st = bStats.get(b.id)!;
    const ru = RUBRIC[b.id] ?? { agentNative: 0, realism: 50, openness: 50 };
    const pairs = b.kind === "agent" ? st.entries : 0;
    const coverage = round1((100 * pairs) / maxPairs);
    const score = round1(BW.agentNative * ru.agentNative + BW.coverage * coverage + BW.realism * ru.realism + BW.openness * ru.openness);
    return {
      id: b.id, name: b.name, kind: b.kind, metric: b.metric, source: b.source, homepage: b.homepage,
      rank: 0, score, agentNative: ru.agentNative, coverage, realism: ru.realism, openness: ru.openness,
      pairs, evaluations: st.runs, entries: st.entries, harnessCount: st.harnesses.size, modelCount: st.models.size,
    };
  });
  benchmarkRanking.sort((a, b) => b.score - a.score);
  benchmarkRanking.forEach((b, i) => (b.rank = i + 1));

  const defaultHarnessId = harnesses.get("claude-code")?.featured
    ? "claude-code"
    : agents.find((a) => harnesses.get(a.harnessId)?.featured)?.harnessId ?? agents[0]?.harnessId ?? "";

  const shownBenchmarks = BENCHMARKS.filter((b) => recs.some((r) => r.benchmark === b.id));
  return {
    meta: {
      title: "ixio — best models for coding agents",
      status: "live",
      scrapedAt,
      defaultHarnessId,
      sources,
      totalEntries: records.length,
      harnessCount: boards.length,
      modelCount: models.length,
      benchmarkCount: shownBenchmarks.length,
      notes: "Aggregated from public leaderboards. Each cell is that benchmark's headline metric; composites are percentile-blended across benchmarks.",
    },
    benchmarks: shownBenchmarks,
    harnesses: [...harnesses.values()],
    boards,
    agents,
    agentsOpen,
    models,
    labs,
    labsOpen,
    benchmarkRanking,
  };
}
