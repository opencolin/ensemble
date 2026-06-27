import { fetchText, parseHtmlTable } from "../util";
import type { RawRecord } from "../record";

export const CHATBOT_ARENA_URL = "https://openlm.ai/chatbot-arena/";

// One static table carries several model-level benchmarks. Each becomes its own
// benchmark in ixio. (column header, benchmark id, unit)
const COLS: { header: string; benchmark: string; unit: "elo" | "index" | "pct" }[] = [
  { header: "Coding", benchmark: "arena-coding", unit: "elo" },
  { header: "AAII", benchmark: "artificial-analysis", unit: "index" },
  { header: "ARC-AGI", benchmark: "arc-agi", unit: "pct" },
];

export async function fetchChatbotArena(): Promise<RawRecord[]> {
  const rows = parseHtmlTable(await fetchText(CHATBOT_ARENA_URL));
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const idx = (h: string) => header.indexOf(h.toLowerCase());
  const mi = idx("model"), oi = idx("organization"), li = idx("license");
  const cols = COLS.map((c) => ({ ...c, i: idx(c.header) })).filter((c) => c.i >= 0);
  if (mi < 0 || !cols.length) return [];

  const out: RawRecord[] = [];
  for (const r of rows.slice(1)) {
    const model = r[mi];
    if (!model) continue;
    for (const c of cols) {
      const v = parseFloat((r[c.i] || "").replace(/[, ]/g, ""));
      if (Number.isNaN(v)) continue;
      out.push({
        source: "chatbot-arena",
        benchmark: c.benchmark,
        benchmarkKind: "model",
        modelName: model,
        modelOrg: oi >= 0 ? r[oi] : undefined,
        license: li >= 0 ? r[li] : undefined,
        score: v,
        unit: c.unit,
      });
    }
  }
  return out;
}
