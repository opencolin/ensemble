import { fetchText } from "../util";
import type { RawRecord } from "../record";

// BridgeBench (BridgeMind) — a "vibe coding" benchmark: real UI / debugging tasks
// measured direct from each provider's API, scored in a real browser, with the
// task set rebuilt every 90 days. The bridgebench.ai site is Cloudflare-walled,
// but BridgeMind publishes each season's snapshot in the public repo, so we read
// it straight from GitHub raw (no bot wall, and it auto-updates as models are run).
// Model-level benchmark; headline metric is `qualifiedRate` (% of tasks passed).
export const BRIDGE_BENCH_URL =
  "https://raw.githubusercontent.com/bridge-mind/bridgebench/HEAD/snapshots/season-1/ui-bench-snapshot.json";

interface RosterEntry {
  modelId: string;
  displayName?: string;
  qualifiedRate?: number; // 0..100
}

export async function fetchBridgeBench(): Promise<RawRecord[]> {
  const data = JSON.parse(await fetchText(BRIDGE_BENCH_URL, 30000)) as { roster?: RosterEntry[] };
  const out: RawRecord[] = [];
  for (const r of data.roster ?? []) {
    if (typeof r.qualifiedRate !== "number" || !r.modelId) continue;
    // modelId looks like "openrouter/z-ai/glm-5.2" — the provider is the segment after "openrouter/".
    const parts = r.modelId.split("/");
    const org = parts[0] === "openrouter" ? parts[1] : parts[0];
    out.push({
      source: "bridge-bench",
      benchmark: "bridge-bench",
      benchmarkKind: "model",
      modelName: r.displayName || r.modelId,
      modelOrg: org,
      score: Math.round(r.qualifiedRate * 10) / 10,
      unit: "pct",
    });
  }
  return out;
}
