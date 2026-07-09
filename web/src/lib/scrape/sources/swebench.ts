import { fetchText, parseHtmlTable } from "../util";
import type { RawRecord } from "../record";

export const SWE_BENCH_URL = "https://openlm.ai/swe-bench/";

// openlm.ai now lists SWE-bench model-level (it dropped the per-row "Agent"
// column). Columns: Model | SWE-bench | 🏆 IOI | Organization | License | Date.
// Without a harness per row it's a model-level benchmark (best resolved-rate
// per model) rather than a (harness × model) agent benchmark.
export async function fetchSweBench(): Promise<RawRecord[]> {
  const rows = parseHtmlTable(await fetchText(SWE_BENCH_URL));
  const out: RawRecord[] = [];
  for (const r of rows) {
    if (r[0]?.trim() === "Model" || r.length < 6) continue;
    const [model, swe, , org, license, date] = r;
    const score = parseFloat(swe);
    if (!model?.trim() || Number.isNaN(score)) continue;
    out.push({
      source: "swe-bench",
      benchmark: "swe-bench",
      benchmarkKind: "model",
      modelName: model.trim(),
      modelOrg: org?.trim(),
      license: license?.trim(),
      date: date?.trim(),
      score,
      unit: "pct",
    });
  }
  return out;
}
