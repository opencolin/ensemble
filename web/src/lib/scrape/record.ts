// A single scraped leaderboard row, before canonicalization/merge.
export interface RawRecord {
  source: string;
  benchmark: string;
  benchmarkKind: "agent" | "model";
  /** Present for agent benchmarks (the scaffold/CLI). */
  harnessName?: string;
  harnessOrg?: string;
  modelName: string;
  modelOrg?: string;
  /** Score in display units. */
  score: number;
  unit: "pct" | "elo" | "index";
  date?: string;
  stderr?: number;
  license?: string;
  /** Declared reference value (not measured by our harness). */
  anchor?: boolean;
  /** Underlying evaluations this record aggregates (e.g. CAB pass rate over N tasks). Default 1. */
  runs?: number;
}
