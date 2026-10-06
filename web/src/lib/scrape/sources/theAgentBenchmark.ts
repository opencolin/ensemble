import { fetchText } from "../util";
import type { RawRecord } from "../record";

export const THE_AGENT_BENCHMARK_URL = "https://theagentbenchmark.com/";

// The Agent Benchmark scores ~1k AI agent *products* 0–10 on cited public
// evidence: Proof (30%), Scale (30%), Momentum (25%), Autonomy (15%). No model,
// no harness×model pair — it rates the shipping product, i.e. our harness axis.
// We keep its "Software engineer" market: that's the coding agents. The whole
// ranked list is SSR'd on the homepage, one <li> per agent:
//   <li data-cat data-market data-maker data-r="rank" …>
//     href="/agents/slug/" … class="ar-n">Name< … class="ar-batch">by Org|YC batch<
//     4× title="Proof|Scale|Momentum|Autonomy: note">N<  +  title="Score out of 10">9.7<
// Full-site snapshot (evidence, news, every market): scripts/scrape_agent_benchmark.mjs
// → web/src/data/agent-benchmark.json.
export async function fetchTheAgentBenchmark(): Promise<RawRecord[]> {
  const html = await fetchText(THE_AGENT_BENCHMARK_URL, 30000);
  const list = html.match(/<ol class="ar-list"[^>]*>(.*?)<\/ol>/s)?.[1] ?? html;

  const out: RawRecord[] = [];
  for (const row of list.split(/<li (?=data-cat=)/).slice(1)) {
    if (row.match(/data-market="([^"]+)"/)?.[1] !== "ai-software-engineer") continue;
    const name = row.match(/class="ar-n"[^>]*>([^<]+)</)?.[1]?.trim();
    const score = parseFloat(row.match(/title="Score out of 10">([\d.]+)</)?.[1] ?? "");
    if (!name || Number.isNaN(score)) continue;
    const maker = row.match(/data-maker="([^"]+)"/)?.[1]; // yc | startup | big_company
    const batch = row.match(/class="ar-batch"[^>]*>(?:by )?([^<]+)</)?.[1]?.trim();
    const parts: Record<string, number> = {};
    for (const [, part, v] of row.matchAll(/title="(Proof|Scale|Momentum|Autonomy): [^"]*">(\d+)</g)) {
      parts[part.toLowerCase()] = parseInt(v, 10);
    }
    out.push({
      source: "the-agent-benchmark",
      benchmark: "the-agent-benchmark",
      benchmarkKind: "harness",
      harnessName: name,
      // Big companies carry "by Org"; YC rows carry the batch — the company is the agent itself.
      harnessOrg: maker === "big_company" ? batch : name,
      score: Math.round(score * 100) / 10, // 0–10 → 0–100
      unit: "index",
      parts,
    });
  }
  return out;
}
