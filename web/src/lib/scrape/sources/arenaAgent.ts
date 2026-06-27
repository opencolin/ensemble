import { fetchText, parseHtmlTable, parsePercent } from "../util";
import type { RawRecord } from "../record";

export const ARENA_AGENT_URL = "https://arena.ai/leaderboard/agent";

// Model cell looks like "Anthropic Claude Fable 5 (High) Anthropic · Proprietary".
// Pull the org/license off the end, then strip a duplicated leading org.
function parseModelCell(cell: string): { name: string; org?: string } {
  let left = cell.trim();
  let org: string | undefined;
  const dot = left.lastIndexOf("·");
  if (dot >= 0) left = left.slice(0, dot).trim();
  const m = left.match(/\s([A-Z][\w.]*(?:\s+AI)?)$/);
  if (m) {
    org = m[1];
    left = left.slice(0, left.length - m[1].length).trim();
    if (left.startsWith(org)) left = left.slice(org.length).trim();
  }
  return { name: left, org };
}

// Model-level agentic leaderboard. Headline metric: "Net Improvement".
export async function fetchArenaAgent(): Promise<RawRecord[]> {
  const rows = parseHtmlTable(await fetchText(ARENA_AGENT_URL));
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const mi = header.indexOf("model");
  const si = header.indexOf("net improvement");
  if (mi < 0 || si < 0) return [];

  const out: RawRecord[] = [];
  for (const r of rows.slice(1)) {
    if (!r[mi]) continue;
    const p = parsePercent(r[si]);
    if (!p) continue;
    const { name, org } = parseModelCell(r[mi]);
    if (!name) continue;
    out.push({
      source: "arena-agent",
      benchmark: "arena-agent",
      benchmarkKind: "model",
      modelName: name,
      modelOrg: org,
      score: p.pct,
      stderr: p.stderr,
      unit: "pct",
    });
  }
  return out;
}
