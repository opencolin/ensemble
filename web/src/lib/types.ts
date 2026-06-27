// ixio data contract (benchmark-centric, scraped from public leaderboards).
//
// Agent = Model + Harness. Each public leaderboard row is a (harness, model) pair
// with a score on some benchmark. We scrape those, canonicalize names, and merge
// into: per-harness model boards (homepage) + a harness ranking (Top Agent page).

export type Tier = "excellent" | "solid" | "iffy";
export type HarnessKind = "cli" | "tui" | "ide" | "agent" | "platform";

export interface Benchmark {
  id: string; // "terminal-bench"
  name: string; // "Terminal-Bench 2.0"
  metric: string; // "Accuracy"
  /** "agent" = scored via a (harness, model) pair; "model" = scored on the raw model. */
  kind: "agent" | "model";
  unit: "pct" | "elo" | "index";
  blurb: string;
  source: string; // leaderboard URL we scrape
  homepage: string;
}

export interface ScoreCell {
  /** Normalized 0..1. */
  value: number;
  /** Original percentage 0..100. */
  raw: number;
  date?: string;
  verified?: boolean;
  stderr?: number;
  /** Declared reference value, not a measurement by our harness (e.g. Anthropic's
   *  own flagships on the Claude Code board). Rendered with a "ref" badge. */
  anchor?: boolean;
}

export interface ModelEntry {
  modelId: string;
  modelName: string;
  vendor: string;
  openWeight: boolean;
  /** benchmarkId -> score for THIS (harness, model). */
  scores: Record<string, ScoreCell>;
  /** 0..100 blended across available benchmarks. */
  composite: number;
  rank: number;
  tier: Tier;
}

export interface Harness {
  id: string;
  name: string;
  vendor: string;
  kind: HarnessKind;
  /** Enough models to feature in the homepage switcher. */
  featured: boolean;
  /** Project/repo URL, when known. */
  homepage?: string;
}

export interface HarnessBoard {
  harnessId: string;
  models: ModelEntry[];
  /** Benchmarks with data on this board. */
  benchmarks: string[];
}

export interface AgentEntry {
  harnessId: string;
  rank: number;
  score: number; // 0..100
  tier: Tier;
  bestModelId: string;
  bestModelName: string;
  bestScore: number; // 0..100
  medianScore: number;
  modelsTested: number;
  benchmarks: string[];
}

/** A model aggregated across all benchmarks (model-level + best agent result). */
export interface ModelProfile {
  modelId: string;
  modelName: string;
  vendor: string;
  openWeight: boolean;
  /** Best score per benchmark (model benchmarks + best agent result). */
  scores: Record<string, ScoreCell>;
  /** Headline best result. */
  best: { benchmark: string; raw: number; harnessId?: string } | null;
  /** 0..100, percentile-blended across benchmarks (fair across scales). */
  composite: number;
  rank: number;
  tier: Tier;
}

/** A lab/company, represented by its single best model (Top Labs). */
export interface LabEntry {
  vendor: string;
  rank: number;
  score: number; // 0..100 = best model's composite
  tier: Tier;
  bestModelId: string;
  bestModelName: string;
  modelCount: number;
  openWeight: boolean;
}

/** A benchmark ranked against the other benchmarks (Top Benchmark page). */
export interface BenchmarkRank {
  id: string;
  name: string;
  kind: "agent" | "model";
  metric: string;
  source: string;
  homepage: string;
  rank: number;
  score: number; // composite 0-100
  // The four criteria (each 0-100):
  agentNative: number; // scores a real (harness × model) pair, not just the model
  coverage: number; // breadth of agent × model combinations measured
  realism: number; // executable real-world coding tasks vs preference/aggregate
  openness: number; // open data + reproducible receipts
  pairs: number; // distinct (harness × model) combinations
  evaluations: number; // total underlying runs (pairs × tasks where exposed, e.g. CAB)
  entries: number;
  harnessCount: number;
  modelCount: number;
}

export interface SourceStatus {
  id: string;
  name: string;
  url: string;
  ok: boolean;
  entries: number;
}

export interface Leaderboard {
  meta: {
    title: string;
    status: "live" | "snapshot";
    scrapedAt: string; // ISO datetime
    defaultHarnessId: string;
    sources: SourceStatus[];
    totalEntries: number;
    harnessCount: number;
    modelCount: number;
    benchmarkCount: number;
    notes: string;
  };
  benchmarks: Benchmark[];
  harnesses: Harness[];
  boards: HarnessBoard[];
  agents: AgentEntry[];
  /** Harnesses re-ranked using only their open-weight models. */
  agentsOpen: AgentEntry[];
  models: ModelProfile[];
  labs: LabEntry[];
  /** Teams re-ranked by their best open-weight model. */
  labsOpen: LabEntry[];
  /** The benchmarks themselves, ranked (Top Benchmark page). */
  benchmarkRanking: BenchmarkRank[];
}

export const BENCHMARK_CRITERIA: { key: "agentNative" | "coverage" | "realism" | "openness"; label: string; weight: number; blurb: string }[] = [
  { key: "agentNative", label: "Agent-native", weight: 0.3, blurb: "Scores a real (harness × model) pair — the full agent — not just the bare model." },
  { key: "coverage", label: "Stack coverage", weight: 0.3, blurb: "How many distinct agent × model combinations it actually runs." },
  { key: "realism", label: "Task realism", weight: 0.25, blurb: "Executable, real-world coding tasks with hard pass/fail — not human preference or aggregate scores." },
  { key: "openness", label: "Open & reproducible", weight: 0.15, blurb: "Open data with per-run receipts you can audit." },
];

export const TIER_META: Record<Tier, { label: string; sub: string }> = {
  excellent: { label: "Excellent", sub: "top 25%" },
  solid: { label: "Solid", sub: "middle of the pack" },
  iffy: { label: "Iffy", sub: "bottom 40%" },
};

export const KIND_LABEL: Record<HarnessKind, string> = {
  cli: "CLI",
  tui: "TUI",
  ide: "IDE",
  agent: "Agent",
  platform: "Platform",
};
