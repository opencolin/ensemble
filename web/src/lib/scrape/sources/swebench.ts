import { fetchText, parseHtmlTable } from "../util";
import type { RawRecord } from "../record";

export const SWE_BENCH_URL = "https://openlm.ai/swe-bench/";

// Columns: Model | SWE-bench | IOI | Organization | License | Date | Agent
export async function fetchSweBench(): Promise<RawRecord[]> {
  const rows = parseHtmlTable(await fetchText(SWE_BENCH_URL));
  const out: RawRecord[] = [];
  for (const r of rows) {
    if (r[0] === "Model" || r.length < 7) continue;
    const [model, swe, , org, license, date, agent] = r;
    const score = parseFloat(swe);
    if (!model || !agent || Number.isNaN(score)) continue;
    out.push({
      source: "swe-bench",
      benchmark: "swe-bench",
      benchmarkKind: "agent",
      harnessName: agent,
      modelName: model,
      modelOrg: org,
      license,
      date,
      score,
      unit: "pct",
    });
  }
  return out;
}
