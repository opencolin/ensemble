// A single scraped leaderboard row, before canonicalization/merge.
export interface RawRecord {
  source: string;
  benchmark: string;
  /** "agent" = (harness, model) pair; "model" = raw model; "harness" = the harness/product alone. */
  benchmarkKind: "agent" | "model" | "harness";
  /** Present for agent and harness benchmarks (the scaffold/CLI/product). */
  harnessName?: string;
  harnessOrg?: string;
  /** Absent for harness benchmarks — they score the product, not a model. */
  modelName?: string;
  modelOrg?: string;
  /** Score in display units. */
  score: number;
  unit: "pct" | "elo" | "index";
  /** Subscores in source units (e.g. The Agent Benchmark's proof/scale/momentum/autonomy, 0-10). */
  parts?: Record<string, number>;
  date?: string;
  stderr?: number;
  license?: string;
  /** Declared reference value (not measured by our harness). */
  anchor?: boolean;
  /** Underlying evaluations this record aggregates (e.g. CAB pass rate over N tasks). Default 1. */
  runs?: number;
}
