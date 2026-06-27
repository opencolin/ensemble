import { fetchText } from "../util";
import type { RawRecord } from "../record";

export const STRATIX_CUP_URL = "https://layerlens.ai/stratix-cup/season-1/schedule/";

// LayerLens "Stratix Cup" — 16 frontier models in a head-to-head tournament where
// each writes its own soccer-strategy code. We read the full schedule (every
// finished match: `model1 score1-score2 model2`, round), rebuild the group
// standings + knockout progression, and score each model 0..100:
//   points = groupPts + 5·knockoutWins + 0.1·goalDiff   (then scaled so the leader = 100)
// It's a model-level benchmark (no harness), so it lands on model + team rankings.

// The site doesn't label vendors, so infer the lab from the model name.
function orgFor(name: string): string | undefined {
  const n = name.toLowerCase();
  if (/^(opus|sonnet|haiku|claude)/.test(n)) return "Anthropic";
  if (n.startsWith("gpt")) return "OpenAI";
  if (n.startsWith("grok")) return "xAI";
  if (n.startsWith("kimi")) return "Moonshot AI";
  if (n.startsWith("deepseek")) return "DeepSeek";
  if (n.startsWith("minimax")) return "MiniMax";
  if (n.startsWith("glm")) return "Z.ai";
  if (n.startsWith("qwen")) return "Alibaba";
  if (n.startsWith("gemini")) return "Google";
  if (n.startsWith("nemotron")) return "NVIDIA";
  if (n.startsWith("mistral")) return "Mistral AI";
  if (n.startsWith("mimo")) return "Xiaomi";
  if (n.startsWith("seed")) return "ByteDance";
  return undefined;
}

// One finished match: model1 + crest, the "N-M" score, model2 + crest, then the round label.
const MATCH_RE =
  /<span[^>]*>([^<]+?)<\/span><img[^>]*>\s*<\/div>\s*<div[^>]*>\s*<span[^>]*>(\d+)<span[^>]*>\s*-\s*<\/span>(\d+)<\/span>\s*<\/div>\s*<div[^>]*>\s*<img[^>]*>\s*<span[^>]*>([^<]+?)<\/span>.*?(Group [A-D]|Quarter-Final|Semi-Final|Final)/gs;

export async function fetchStratixCup(): Promise<RawRecord[]> {
  const html = await fetchText(STRATIX_CUP_URL, 30000);

  const gp: Record<string, number> = {}; // group points
  const gd: Record<string, number> = {}; // goal difference
  const kw: Record<string, number> = {}; // knockout wins
  const seen = (m: string) => {
    if (!(m in gp)) { gp[m] = 0; gd[m] = 0; kw[m] = 0; }
  };

  let m: RegExpExecArray | null;
  while ((m = MATCH_RE.exec(html))) {
    const a = m[1].trim(), b = m[4].trim();
    const s1 = parseInt(m[2], 10), s2 = parseInt(m[3], 10);
    seen(a); seen(b);
    if (m[5].startsWith("Group")) {
      gd[a] += s1 - s2; gd[b] += s2 - s1;
      if (s1 > s2) gp[a] += 3;
      else if (s2 > s1) gp[b] += 3;
      else { gp[a] += 1; gp[b] += 1; }
    } else {
      kw[s1 > s2 ? a : b] += 1; // knockout: the winner advances
    }
  }

  const models = Object.keys(gp);
  if (!models.length) return [];
  const pts: Record<string, number> = {};
  for (const name of models) pts[name] = gp[name] + 5 * kw[name] + 0.1 * gd[name];
  const max = Math.max(...Object.values(pts)) || 1;

  return models.map((name) => ({
    source: "stratix-cup",
    benchmark: "stratix-cup",
    benchmarkKind: "model" as const,
    modelName: name,
    modelOrg: orgFor(name),
    score: Math.max(0, Math.round((1000 * pts[name]) / max) / 10), // 0..100, leader = 100
    unit: "index" as const,
  }));
}
