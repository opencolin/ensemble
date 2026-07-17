import { fetchText } from "../util";
import type { RawRecord } from "../record";

// Artificial Analysis (artificialanalysis.ai/models) — their headline indices
// per model, straight from the source (openlm.ai only mirrors the intelligence
// number). The page is a Next.js App-Router app: no __NEXT_DATA__, but the model
// table ships in the streamed RSC flight payload (self.__next_f chunks) as an
// `initialModels` array. We reassemble the flight string, pull that array, and
// emit two benchmarks: Intelligence Index (general) and Coding Index (their
// composite of coding evals — the one that matters most here).
export const ARTIFICIAL_ANALYSIS_URL = "https://artificialanalysis.ai/models/";

interface AAModel {
  name: string;
  shortName?: string;
  intelligenceIndex?: number | null;
  codingIndex?: number | null;
  creator?: { name?: string } | null;
}

/** Reassemble the App-Router flight payload from the inline self.__next_f pushes. */
function flightBlob(html: string): string {
  const chunks = html.match(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g) ?? [];
  let out = "";
  for (const c of chunks) {
    const m = c.match(/\[1,("(?:[^"\\]|\\.)*")\]/);
    if (m) {
      try { out += JSON.parse(m[1]) as string; } catch { /* skip malformed chunk */ }
    }
  }
  return out;
}

/** Bracket-match a JSON array starting at `[` (string/escape aware). */
function matchArray(s: string, start: number): string | null {
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < s.length; k++) {
    const c = s[k];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]") { if (--depth === 0) return s.slice(start, k + 1); }
  }
  return null;
}

const cleanName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "").trim();

export async function fetchArtificialAnalysis(): Promise<RawRecord[]> {
  const blob = flightBlob(await fetchText(ARTIFICIAL_ANALYSIS_URL, 45000));
  const key = '"initialModels":';
  const at = blob.indexOf(key);
  if (at < 0) return [];
  const arrText = matchArray(blob, at + key.length);
  if (!arrText) return [];

  let models: AAModel[];
  try { models = JSON.parse(arrText); } catch { return []; }
  if (!Array.isArray(models) || !models.length) return [];

  const out: RawRecord[] = [];
  for (const m of models) {
    const name = cleanName(m.shortName || m.name || "");
    if (!name) continue;
    const org = m.creator?.name || undefined;
    const push = (benchmark: string, v: number | null | undefined) => {
      if (typeof v === "number" && Number.isFinite(v)) {
        out.push({ source: "artificial-analysis", benchmark, benchmarkKind: "model", modelName: name, modelOrg: org, score: Math.round(v * 10) / 10, unit: "index" });
      }
    };
    push("artificial-analysis", m.intelligenceIndex);
    push("aa-coding", m.codingIndex);
  }
  return out;
}
