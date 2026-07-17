// DeepResearch-Bench (muset-ai) — a leaderboard for Deep Research AGENTS: tools
// that plan a multi-step web investigation and write a cited report (OpenAI/Gemini
// DeepResearch, Perplexity Research, Kimi Researcher, …). A distinct agent
// category from coding, so it gets its own board. The HF Space stores its
// leaderboard as a CSV in the repo, which we read from HF raw (no bot wall,
// auto-updates as they re-score).
export const DEEP_RESEARCH_URL =
  "https://huggingface.co/spaces/muset-ai/DeepResearch-Bench-Leaderboard/raw/main/data/leaderboard.csv";
export const DEEP_RESEARCH_SITE = "https://huggingface.co/spaces/muset-ai/DeepResearch-Bench-Leaderboard";

export interface DRAgent {
  name: string;
  overall: number;
  comprehensiveness: number | null;
  insight: number | null;
  instructionFollowing: number | null;
  readability: number | null;
  citationAccuracy: number | null; // only measured for a subset
  effectiveCitations: number | null;
}

export interface DeepResearchBench {
  updated: string;
  rows: DRAgent[];
}

const num = (v: string | undefined): number | null => {
  const n = parseFloat((v ?? "").trim());
  return Number.isFinite(n) ? n : null; // "-" (unmeasured) -> null
};

/** Prettify a raw agent id: "zhipu_deep_research" -> "Zhipu Deep Research",
 *  while leaving already-cased product names (GPT-5, DeepResearch) recognizable. */
function displayName(raw: string): string {
  const t = raw.trim();
  if (/[A-Z]/.test(t) && /[a-z]/.test(t) && !t.includes("_")) return t; // already a product name
  return t
    .replace(/[_]+/g, " ")
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export async function fetchDeepResearch(): Promise<DeepResearchBench | null> {
  let text: string;
  try {
    const res = await fetch(DEEP_RESEARCH_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ixio-leaderboard/1.0; +https://ixio.com)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null;
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const iModel = idx("model"), iOverall = idx("overall_score");
  if (iModel < 0 || iOverall < 0) return null;

  const rows: DRAgent[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(","); // model names carry no commas in this dataset
    const overall = num(c[iOverall]);
    if (!c[iModel]?.trim() || overall == null) continue;
    rows.push({
      name: displayName(c[iModel]),
      overall,
      comprehensiveness: num(c[idx("comprehensiveness")]),
      insight: num(c[idx("insight")]),
      instructionFollowing: num(c[idx("instruction_following")]),
      readability: num(c[idx("readability")]),
      citationAccuracy: num(c[idx("citation_accuracy")]),
      effectiveCitations: num(c[idx("effective_citations")]),
    });
  }
  rows.sort((a, b) => b.overall - a.overall);
  return { updated: new Date().toISOString().slice(0, 10), rows };
}
