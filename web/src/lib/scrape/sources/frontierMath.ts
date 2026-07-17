import { fetchText } from "../util";
import type { RawRecord } from "../record";

// FrontierMath (Epoch AI) — exceptionally difficult research-level math problems,
// run by Epoch on a PRIVATE held-out set (so it resists contamination). Their site
// is client-rendered, but every chart reads from open CSVs; benchmarks.csv holds
// one row per (model, task) run with a verified score.
//
// We take Tier 4 (v2) — what epoch.ai/frontiermath resolves to, the hardest tier.
// Public-subset variants exist but are tiny and statistically noisy (±50pp), so
// we use the private set only. A model can have several runs; we keep its best.
export const FRONTIER_MATH_URL = "https://epoch.ai/data/benchmarks.csv";
export const FRONTIER_MATH_PAGE = "https://epoch.ai/benchmarks/frontiermath-tier-4-v2";
const TASK = "FrontierMath-Tier-4-v2-Private";

/** RFC4180 CSV parse — Epoch's notes fields contain commas, quotes AND newlines,
 *  so a split(",") would shred the file. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function fetchFrontierMath(): Promise<RawRecord[]> {
  const rows = parseCsv(await fetchText(FRONTIER_MATH_URL, 60000));
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  const col = (n: string) => header.indexOf(n);
  const iTask = col("task"), iModel = col("Model"), iOrg = col("Organization");
  const iScore = col("best_score"), iErr = col("stderr"), iStatus = col("Status");
  if (iTask < 0 || iModel < 0 || iScore < 0) return [];

  // best run per model
  const best = new Map<string, { score: number; stderr: number; org: string }>();
  for (const r of rows.slice(1)) {
    if (r[iTask] !== TASK) continue;
    if (iStatus >= 0 && (r[iStatus] || "").trim().toLowerCase() !== "success") continue;
    const name = (r[iModel] || "").trim();
    const score = parseFloat(r[iScore]);
    if (!name || !Number.isFinite(score)) continue;
    const prev = best.get(name);
    if (!prev || score > prev.score) {
      best.set(name, { score, stderr: parseFloat(r[iErr] ?? ""), org: (r[iOrg] || "").trim() });
    }
  }

  return [...best.entries()].map(([modelName, v]) => ({
    source: "frontier-math",
    benchmark: "frontier-math",
    benchmarkKind: "model" as const,
    modelName,
    modelOrg: v.org || undefined,
    score: Math.round(1000 * v.score) / 10, // 0..1 -> percent, 1dp
    stderr: Number.isFinite(v.stderr) ? Math.round(1000 * v.stderr) / 10 : undefined,
    unit: "pct" as const,
  }));
}
