import "server-only";
import { cache } from "react";
import type { Leaderboard } from "./types";
import { buildLeaderboard } from "./scrape/build";
import snapshot from "@/data/leaderboard.snapshot.json";

// In-process memo. ISR already caches each page ~daily, but CodingAgentBench is a
// ~27MB page that Next's data cache won't store (>2MB), so without this every page
// render (and every build page) would re-scrape it. Memo dedupes across a build /
// warm lambda; the page-level `revalidate` still drives the ~daily refresh.
let memo: { lb: Leaderboard; at: number } | null = null;
const MEMO_TTL = 30 * 60 * 1000;

export const getLeaderboard = cache(async (): Promise<Leaderboard> => {
  if (memo && Date.now() - memo.at < MEMO_TTL) return memo.lb;
  try {
    const lb = await buildLeaderboard(new Date().toISOString());
    if (lb.meta.totalEntries > 0) {
      memo = { lb, at: Date.now() };
      return lb;
    }
    console.error("[leaderboard] live build returned 0 entries; using snapshot");
  } catch (e) {
    console.error("[leaderboard] live build failed; using snapshot:", e);
  }
  const snap = snapshot as unknown as Leaderboard;
  return { ...snap, meta: { ...snap.meta, status: "snapshot" } };
});
