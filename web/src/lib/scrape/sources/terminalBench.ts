import { fetchText, parseHtmlTable, parsePercent } from "../util";
import type { RawRecord } from "../record";

export const TERMINAL_BENCH_URL = "https://www.tbench.ai/leaderboard/terminal-bench/2.0";

// Columns: "" | Rank | Agent | Model | Date | Agent Org | Model Org | Accuracy
export async function fetchTerminalBench(): Promise<RawRecord[]> {
  const rows = parseHtmlTable(await fetchText(TERMINAL_BENCH_URL));
  const out: RawRecord[] = [];
  for (const r of rows) {
    if (r[1] === "Rank" || r.length < 8) continue;
    const [, , agent, model, date, agentOrg, modelOrg, acc] = r;
    if (!agent || !model || /^multiple$/i.test(model)) continue; // skip model-agnostic rows
    const p = parsePercent(acc);
    if (!p) continue;
    out.push({
      source: "terminal-bench",
      benchmark: "terminal-bench",
      benchmarkKind: "agent",
      harnessName: agent,
      harnessOrg: agentOrg,
      modelName: model,
      modelOrg: modelOrg,
      date,
      score: p.pct,
      stderr: p.stderr,
      unit: "pct",
    });
  }
  return out;
}
