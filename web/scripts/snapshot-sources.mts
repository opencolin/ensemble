// Refresh src/data/source-records.snapshot.json — the last-good RawRecords per
// source that buildLeaderboard falls back to when a live scrape fails. Run:
//
//   npx tsx scripts/snapshot-sources.mts
//
// For each source: fresh scrape if it works, else keep its previous snapshot
// records, else reconstruct approximate records from leaderboard.snapshot.json
// (loses per-pair run counts, keeps every score cell).

import { readFileSync, writeFileSync } from "node:fs";
import { SOURCES } from "../src/lib/scrape/build";
import type { RawRecord } from "../src/lib/scrape/record";
import type { Leaderboard } from "../src/lib/types";

const OUT = new URL("../src/data/source-records.snapshot.json", import.meta.url);
const prev: RawRecord[] = JSON.parse(readFileSync(OUT, "utf8"));

// benchmark id -> source id (chatbot-arena feeds three model benchmarks).
const BENCH_SOURCE: Record<string, string> = {
  "coding-agent-bench": "coding-agent-bench",
  "swe-bench": "swe-bench",
  "terminal-bench": "terminal-bench",
  "ensemble-runs": "ensemble-runs",
  "arena-coding": "chatbot-arena",
  "artificial-analysis": "chatbot-arena",
  "arc-agi": "chatbot-arena",
  "arena-agent": "arena-agent",
  "stratix-cup": "stratix-cup",
  "the-agent-benchmark": "the-agent-benchmark",
};

function reconstruct(sourceId: string): RawRecord[] {
  const lb = JSON.parse(
    readFileSync(new URL("../src/data/leaderboard.snapshot.json", import.meta.url), "utf8"),
  ) as Leaderboard;
  const unit = (bid: string) => lb.benchmarks.find((b) => b.id === bid)?.unit ?? "pct";
  const hName = new Map(lb.harnesses.map((h) => [h.id, h]));
  const out: RawRecord[] = [];
  // Agent benchmarks: every (harness, model, benchmark) cell on the boards.
  for (const board of lb.boards) {
    const h = hName.get(board.harnessId);
    for (const m of board.models) {
      for (const [bid, c] of Object.entries(m.scores)) {
        if (BENCH_SOURCE[bid] !== sourceId) continue;
        out.push({
          source: sourceId, benchmark: bid, benchmarkKind: "agent",
          harnessName: h?.name ?? board.harnessId, harnessOrg: h?.vendor,
          modelName: m.modelName, modelOrg: m.vendor !== "Unknown" ? m.vendor : undefined,
          license: m.openWeight ? "open" : "proprietary",
          score: c.raw, unit: unit(bid), date: c.date, stderr: c.stderr, anchor: c.anchor,
        });
      }
    }
  }
  // Model benchmarks: cells on the model profiles.
  const modelBench = new Set(lb.benchmarks.filter((b) => b.kind === "model").map((b) => b.id));
  for (const m of lb.models) {
    for (const [bid, c] of Object.entries(m.scores)) {
      if (!modelBench.has(bid) || BENCH_SOURCE[bid] !== sourceId) continue;
      out.push({
        source: sourceId, benchmark: bid, benchmarkKind: "model",
        modelName: m.modelName, modelOrg: m.vendor !== "Unknown" ? m.vendor : undefined,
        license: m.openWeight ? "open" : "proprietary",
        score: c.raw, unit: unit(bid), date: c.date, stderr: c.stderr, anchor: c.anchor,
      });
    }
  }
  // Harness benchmarks: the traction board.
  for (const t of lb.traction ?? []) {
    if (BENCH_SOURCE[t.benchmark] !== sourceId) continue;
    out.push({
      source: sourceId, benchmark: t.benchmark, benchmarkKind: "harness",
      harnessName: t.name, harnessOrg: t.vendor !== "Unknown" ? t.vendor : undefined,
      score: t.score, unit: unit(t.benchmark), parts: t.parts,
    });
  }
  return out;
}

const out: RawRecord[] = [];
for (const s of SOURCES) {
  let recs: RawRecord[] = [];
  let how = "fresh";
  try {
    recs = await s.fn();
  } catch (e) {
    console.error(`  ${s.id}: scrape failed (${(e as Error).message})`);
  }
  if (!recs.length) {
    recs = prev.filter((r) => r.source === s.id);
    how = "kept previous snapshot";
  }
  if (!recs.length) {
    recs = reconstruct(s.id);
    how = "reconstructed from leaderboard.snapshot.json";
  }
  console.log(`  ${s.id}: ${recs.length} records (${how})`);
  out.push(...recs);
}

writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`wrote ${out.length} records to src/data/source-records.snapshot.json`);
