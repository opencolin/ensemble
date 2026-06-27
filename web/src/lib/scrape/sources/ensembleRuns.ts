import raw from "@/data/ensemble-runs.json";
import type { RawRecord } from "../record";

export const ENSEMBLE_RUNS_URL = "https://github.com/opencolin/ensemble/tree/main/runner";

interface Row {
  harness: string;
  model: string;
  modelName?: string;
  modelOrg?: string;
  passRate: number; // 0..100
  runs?: number;
  date?: string;
  /** Reference anchor (e.g. Anthropic's own flagship on Claude Code), not a measured run. */
  anchor?: boolean;
}

// Not a scrape — reads our own committed results (produced by runner/ensemble_runs.py).
// This is the only source that can fill Claude Code / Codex × open-model cells,
// since no public benchmark runs those pairings.
export async function fetchEnsembleRuns(): Promise<RawRecord[]> {
  const results = ((raw as { results?: Row[] }).results ?? []).filter((r) => r && r.harness && r.model);
  return results.map((r) => ({
    source: "ensemble-runs",
    benchmark: "ensemble-runs",
    benchmarkKind: "agent",
    harnessName: r.harness,
    modelName: r.modelName || r.model,
    modelOrg: r.modelOrg,
    score: Math.round(r.passRate * 10) / 10,
    unit: "pct",
    date: r.date,
    anchor: r.anchor,
  }));
}
