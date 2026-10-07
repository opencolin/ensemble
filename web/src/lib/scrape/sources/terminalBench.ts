import { fetchText } from "../util";
import type { RawRecord } from "../record";

export const TERMINAL_BENCH_URL = "https://www.tbench.ai/leaderboard";

// tbench.ai is a Next.js app whose leaderboard table is client-rendered — the
// SSR'd <table> is empty. Every row does ship in the RSC flight payload as
// escaped JSON: {"date":"…","agent_org":{…,"label":…},"model_org":{…},
// "agent_display":{…},"model_display":{…},…,"metrics":{"accuracy":64.85,…}}.
// We unescape and parse those records (currently Terminal-Bench 4.0).
export async function fetchTerminalBench(): Promise<RawRecord[]> {
  const html = await fetchText(TERMINAL_BENCH_URL, 30000);
  const un = html.replace(/\\"/g, '"');

  const out: RawRecord[] = [];
  for (const chunk of un.split('{"date":"').slice(1)) {
    const head = chunk.slice(0, 2000); // each record's fields sit at the front of its chunk
    const label = (k: string) =>
      head.match(new RegExp(`"${k}":\\{(?:"url":(?:"[^"]*"|null),)?"label":"([^"]+)"`))?.[1];
    const acc = head.match(/"accuracy":([\d.]+)/);
    const agent = label("agent_display");
    const model = label("model_display");
    if (!agent || !model || !acc) continue;
    out.push({
      source: "terminal-bench",
      benchmark: "terminal-bench",
      benchmarkKind: "agent",
      harnessName: agent,
      harnessOrg: label("agent_org"),
      modelName: model,
      modelOrg: label("model_org"),
      date: chunk.slice(0, 10),
      score: parseFloat(acc[1]),
      unit: "pct",
    });
  }
  return out;
}
