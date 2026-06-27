// Pure, client-safe selectors over a Leaderboard object. No fetching/server code,
// so both server pages and client components can use these.
import type { Leaderboard, Harness, HarnessBoard, Benchmark, ModelEntry } from "./types";

export const slugFor = (id: string) => id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

export const getHarness = (lb: Leaderboard, id: string): Harness | undefined =>
  lb.harnesses.find((h) => h.id === id);

export const boardFor = (lb: Leaderboard, id: string): HarnessBoard =>
  lb.boards.find((b) => b.harnessId === id) ??
  lb.boards.find((b) => b.harnessId === lb.meta.defaultHarnessId) ??
  lb.boards[0];

// Harnesses offered in the homepage switcher, in display order. A curated short
// list of the agents people actually reach for — some (Hermes, OpenClaw, Kilo
// Code, Cline, Lemonade) aren't benchmarked yet and show a "not benchmarked"
// state when picked; the full set lives on Top Agent ("More options").
const FEATURED_HARNESS_IDS = [
  "claude-code", "codex-cli", "hermes-agent", "openclaw", "opencode",
  "kilo-code", "pi", "cline", "lemonade", "openhands",
];

export const featuredHarnesses = (lb: Leaderboard): Harness[] =>
  FEATURED_HARNESS_IDS.map((id) => lb.harnesses.find((h) => h.id === id)).filter(
    (h): h is Harness => !!h,
  );

// ---- Top Team detail pages ----
export const teamSlug = (vendor: string) => slugFor(vendor);
export const allTeamSlugs = (lb: Leaderboard) => lb.labs.map((l) => slugFor(l.vendor));
export const vendorForSlug = (lb: Leaderboard, slug: string) =>
  lb.labs.find((l) => slugFor(l.vendor) === slug)?.vendor;
export const getLab = (lb: Leaderboard, vendor: string) => lb.labs.find((l) => l.vendor === vendor);
export const teamModels = (lb: Leaderboard, vendor: string) =>
  lb.models.filter((m) => m.vendor === vendor).sort((a, b) => b.composite - a.composite);

export const getBenchmark = (lb: Leaderboard, id: string): Benchmark | undefined =>
  lb.benchmarks.find((b) => b.id === id);

/** Exact board for a harness (no default fallback) — for the agent detail page. */
export const boardByHarness = (lb: Leaderboard, id: string): HarnessBoard | undefined =>
  lb.boards.find((b) => b.harnessId === id);

export const getAgent = (lb: Leaderboard, id: string) =>
  lb.agents.find((a) => a.harnessId === id);

export const getModelProfile = (lb: Leaderboard, modelId: string) =>
  lb.models.find((m) => m.modelId === modelId);

export const allModelIds = (lb: Leaderboard): string[] => lb.models.map((m) => m.modelId);

export const modelIdForSlug = (lb: Leaderboard, slug: string): string | undefined =>
  lb.models.find((m) => slugFor(m.modelId) === slug)?.modelId;

/** Harnesses that ran a given model, with that model's board entry (model page). */
export function harnessAppearances(
  lb: Leaderboard,
  modelId: string,
): { harness: Harness; entry: ModelEntry }[] {
  const rows: { harness: Harness; entry: ModelEntry }[] = [];
  for (const b of lb.boards) {
    const e = b.models.find((m) => m.modelId === modelId);
    const h = getHarness(lb, b.harnessId);
    if (e && h) rows.push({ harness: h, entry: e });
  }
  return rows.sort((a, b) => b.entry.composite - a.entry.composite);
}
