// Canonicalize messy harness / model / vendor names from scraped leaderboards
// into stable ids so the same thing from two sources merges into one entry.

import type { HarnessKind } from "../types";

export function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const VENDOR_ALIASES: Record<string, string> = {
  "z-ai": "Z.ai", zai: "Z.ai", "z-ai-": "Z.ai", "zai-org": "Z.ai",
  minimax: "MiniMax", minimaxai: "MiniMax",
  moonshot: "Moonshot AI", "moonshot-ai": "Moonshot AI", kimi: "Moonshot AI", moonshotai: "Moonshot AI",
  qwen: "Alibaba", alibaba: "Alibaba",
  openai: "OpenAI", anthropic: "Anthropic", google: "Google", xai: "xAI",
  deepseek: "DeepSeek", "deepseek-ai": "DeepSeek", meta: "Meta", "meta-llama": "Meta",
  mistral: "Mistral AI", mistralai: "Mistral AI",
  afterquery: "AfterQuery", nvidia: "NVIDIA", "stepfun-ai": "StepFun", stepfun: "StepFun",
};

export function canonVendor(org?: string): string {
  if (!org) return "Unknown";
  return VENDOR_ALIASES[slug(org)] ?? org.trim();
}

const OPEN_VENDORS = new Set(["Z.ai", "Alibaba", "DeepSeek", "Moonshot AI", "MiniMax", "Meta", "Mistral AI", "AfterQuery", "NVIDIA", "StepFun"]);

export function isOpenWeight(modelName: string, vendor: string, license?: string): boolean {
  if (license) {
    const l = license.toLowerCase();
    if (l.includes("proprietary")) return false;
    if (/mit|apache|llama|open/.test(l)) return true;
  }
  if (modelName.toLowerCase().includes("gpt-oss")) return true;
  return OPEN_VENDORS.has(vendor);
}

/** Tidy and reorder model names so variants collapse across sources. */
export function canonModelName(name: string): string {
  let n = name.trim().replace(/\s+/g, " ");
  // Drop reasoning-effort markers so "GPT-5.5-high" / "GPT 5.5 (xHigh)" / "… Thinking" merge.
  n = n.replace(/\s*\((High|xHigh|Low|Medium|Minimal|Thinking|Reasoning)\)\s*$/i, "");
  n = n.replace(/\s+(Thinking|Reasoning)\s*$/i, "");
  n = n.replace(/[-\s](high|low|medium|xhigh|minimal)\s*$/i, "");
  // "GPT 5.5" -> "GPT-5.5"
  n = n.replace(/^GPT[\s-]?(\d)/i, "GPT-$1");
  // "Claude 4.6 Opus" -> "Claude Opus 4.6"
  n = n.replace(/^Claude\s+(\d[\d.]*)\s+(Opus|Sonnet|Haiku)\b/i, (_m, v, t) => `Claude ${cap(t)} ${v}`);
  // Bare "Opus 4.8" / "Sonnet 4.6" (e.g. LayerLens) -> "Claude Opus 4.8" so they merge.
  n = n.replace(/^(Opus|Sonnet|Haiku)\b/i, (m) => `Claude ${cap(m)}`);
  // "minimax-m2.5" / "Minimax m2.5" -> "MiniMax M2.5"
  n = n.replace(/^minimax[\s-]*m\s*/i, "MiniMax M");
  // "GLM 5" / "GLM-5" -> "GLM-5"
  n = n.replace(/^GLM[\s-]+/i, "GLM-");
  // "GPT-OSS-120B" casing
  n = n.replace(/^gpt-oss/i, "gpt-oss");
  return n.trim();
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1).toLowerCase();

export interface CanonModel {
  modelId: string;
  modelName: string;
  vendor: string;
  openWeight: boolean;
}
export function canonModel(name: string, org?: string, license?: string): CanonModel {
  const modelName = canonModelName(name);
  const vendor = canonVendor(org);
  return { modelId: slug(modelName), modelName, vendor, openWeight: isOpenWeight(modelName, vendor, license) };
}

interface HInfo { id: string; name: string; vendor: string; kind: HarnessKind; homepage?: string }
const H = (id: string, name: string, vendor: string, kind: HarnessKind, homepage?: string): HInfo => ({ id, name, vendor, kind, homepage });
// Known harnesses (alias slug -> canonical). Unknowns fall through to a default.
const HARNESS_MAP: Record<string, HInfo> = {
  "claude-code": H("claude-code", "Claude Code", "Anthropic", "cli", "https://docs.anthropic.com/en/docs/claude-code"),
  aider: H("aider", "Aider", "Aider", "cli", "https://aider.chat"),
  crush: H("crush", "Crush", "Charm", "tui", "https://github.com/charmbracelet/crush"),
  codex: H("codex-cli", "Codex CLI", "OpenAI", "cli"),
  "codex-cli": H("codex-cli", "Codex CLI", "OpenAI", "cli"),
  "simple-codex": H("simple-codex", "Simple Codex", "OpenAI", "agent"),
  "gemini-cli": H("gemini-cli", "Gemini CLI", "Google", "cli"),
  goose: H("goose", "Goose", "Block", "cli"),
  opencode: H("opencode", "OpenCode", "Anomaly Innovations", "tui"),
  openhands: H("openhands", "OpenHands", "All Hands AI", "agent"),
  "mini-swe-agent": H("mini-swe-agent", "mini-SWE-agent", "Princeton", "agent"),
  "terminus-2": H("terminus-2", "Terminus 2", "Terminal-Bench", "agent"),
  warp: H("warp", "Warp", "Warp", "platform"),
  "junie-cli": H("junie-cli", "Junie CLI", "JetBrains", "cli"),
  "grok-cli": H("grok-cli", "Grok CLI", "xAI", "cli"),
  droid: H("droid", "Droid", "Factory", "agent"),
  "letta-code": H("letta-code", "Letta Code", "Letta", "agent"),
  crux: H("crux", "Crux", "Roam", "agent"),
  mux: H("mux", "Mux", "Coder", "agent"),
  "deep-agents": H("deep-agents", "Deep Agents", "LangChain", "agent"),
  "ii-agent": H("ii-agent", "II-Agent", "Intelligent Internet", "agent"),
  "camel-ai": H("camel-ai", "CAMEL-AI", "CAMEL-AI", "agent"),
  copilot: H("copilot", "Copilot CLI", "GitHub", "cli"),
  pi: H("pi", "pi", "pibase", "cli"),
  plandex: H("plandex", "Plandex", "Plandex", "cli"),
  "qwen-code": H("qwen-code", "Qwen Code", "Alibaba", "cli"),
  cline: H("cline", "Cline", "Cline", "ide"),
  cursor: H("cursor", "Cursor", "Anysphere", "ide"),
  amp: H("amp", "Amp", "Sourcegraph", "cli"),
  // NexAU-AHE — open-source Agentic Harness Engineering (MIT). Auto-evolves the
  // harness around a fixed model — literally Agent = Model + Harness.
  "nexau-ahe": H("nexau-ahe", "NexAU-AHE", "Qiji Zhifeng", "agent", "https://github.com/china-qijizhifeng/agentic-harness-engineering"),
};

export function canonHarness(name: string, org?: string): HInfo {
  const k = slug(name);
  if (HARNESS_MAP[k]) return HARNESS_MAP[k];
  return { id: k, name: name.trim(), vendor: canonVendor(org), kind: inferKind(name) };
}

function inferKind(name: string): HarnessKind {
  const n = name.toLowerCase();
  if (n.includes("cli")) return "cli";
  if (n.includes("desktop") || /\bide\b/.test(n)) return "ide";
  return "agent";
}

/**
 * Notable coding agents that top OpenRouter's coding-apps list but haven't
 * submitted to any benchmark we scrape — so they have no (harness × model)
 * scores. Surfaced on Top Agent as "known, not yet benchmarked." Ordered by
 * OpenRouter coding popularity.
 */
export const KNOWN_HARNESSES: HInfo[] = [
  H("hermes-agent", "Hermes Agent", "Nous Research", "agent", "https://nousresearch.com"),
  H("kilo-code", "Kilo Code", "Kilo", "ide", "https://kilocode.ai"),
  H("openclaw", "OpenClaw", "OpenClaw", "agent"),
  H("lemonade", "Lemonade", "Lemonade", "agent"),
  H("cline", "Cline", "Cline", "ide", "https://cline.bot"),
  H("cursor", "Cursor", "Anysphere", "ide", "https://cursor.com"),
  H("roo-code", "Roo Code", "Roo Code", "ide", "https://roocode.com"),
  H("continue", "Continue", "Continue", "ide", "https://continue.dev"),
];
