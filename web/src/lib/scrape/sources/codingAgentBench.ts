import { fetchText } from "../util";
import type { RawRecord } from "../record";

export const CODING_AGENT_BENCH_URL = "https://codingagentbench.com/leaderboard";

// The page SSRs one <tr> per (harness, model, task) with data-pass="0|1".
// We aggregate to a pass rate per (harness, model). It's a large page (~27MB),
// so allow a generous timeout; failures degrade gracefully (Promise.allSettled).
export async function fetchCodingAgentBench(): Promise<RawRecord[]> {
  const html = await fetchText(CODING_AGENT_BENCH_URL, 60000);
  const re = /data-tui="([^"]+)"\s+data-model="([^"]+)"[^>]*?\sdata-pass="([0-9.]+)"/g;

  const agg = new Map<string, { tui: string; model: string; pass: number; n: number }>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const pass = parseFloat(m[3]);
    if (Number.isNaN(pass)) continue;
    const key = `${m[1]}|${m[2]}`;
    const a = agg.get(key) ?? { tui: m[1], model: m[2], pass: 0, n: 0 };
    a.pass += pass > 0 ? 1 : 0;
    a.n += 1;
    agg.set(key, a);
  }

  const out: RawRecord[] = [];
  for (const a of agg.values()) {
    if (!a.n) continue;
    const slash = a.model.indexOf("/");
    const modelOrg = slash > 0 ? a.model.slice(0, slash) : undefined;
    const modelName = slash > 0 ? a.model.slice(slash + 1) : a.model;
    out.push({
      source: "coding-agent-bench",
      benchmark: "coding-agent-bench",
      benchmarkKind: "agent",
      harnessName: a.tui,
      modelName,
      modelOrg,
      score: Math.round((1000 * a.pass) / a.n) / 10, // pass rate %
      unit: "pct",
      runs: a.n, // this pair was evaluated on a.n tasks
    });
  }
  return out;
}
