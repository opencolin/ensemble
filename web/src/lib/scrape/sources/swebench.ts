import { fetchText } from "../util";
import type { RawRecord } from "../record";

export const SWE_BENCH_URL = "https://www.swebench.com/";

// swebench.com dropped its SSR'd table: the page now embeds every leaderboard
// as one JSON blob in <script type="application/json" id="leaderboard-data">
// — [{ name: "Verified" | "Lite" | …, results: [...] }]. We take Verified.
interface SweResult {
  agent?: string;
  agent_org?: string;
  model_display?: string | null;
  model_org?: string | null;
  /** % resolved, e.g. 79.2 */
  resolved?: number | null;
  date?: string;
  /** Open-source model flag as declared by the submission. */
  os_model?: boolean;
}

export async function fetchSweBench(): Promise<RawRecord[]> {
  const html = await fetchText(SWE_BENCH_URL, 60000);
  const m = html.match(/<script type="application\/json" id="leaderboard-data"[^>]*>(.*?)<\/script>/s);
  if (!m) return [];
  const boards = JSON.parse(m[1]) as { name: string; results: SweResult[] }[];
  const verified = boards.find((b) => b.name === "Verified");

  const out: RawRecord[] = [];
  for (const r of verified?.results ?? []) {
    if (!r.agent || !r.model_display || typeof r.resolved !== "number") continue;
    if (/^multiple$/i.test(r.model_display)) continue; // model-agnostic rows can't rank a model
    out.push({
      source: "swe-bench",
      benchmark: "swe-bench",
      benchmarkKind: "agent",
      harnessName: r.agent,
      harnessOrg: r.agent_org,
      modelName: r.model_display,
      modelOrg: r.model_org ?? undefined,
      // os_model=false doesn't prove proprietary, so only assert openness.
      license: r.os_model ? "open" : undefined,
      date: r.date,
      score: r.resolved,
      unit: "pct",
    });
  }
  return out;
}
