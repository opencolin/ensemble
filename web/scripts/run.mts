import { writeFileSync } from "node:fs";
import { buildLeaderboard } from "../src/lib/scrape/build";

const lb = await buildLeaderboard(new Date().toISOString());

writeFileSync(new URL("../src/data/leaderboard.snapshot.json", import.meta.url), JSON.stringify(lb, null, 2) + "\n");

const p = (x: number) => `${x.toFixed(1)}`;
console.log("\n=== SOURCES ===");
for (const s of lb.meta.sources) console.log(`  ${s.ok ? "ok " : "FAIL"} ${s.name.padEnd(16)} ${s.entries} entries`);
console.log(`  total records: ${lb.meta.totalEntries} | harnesses: ${lb.meta.harnessCount} | models: ${lb.meta.modelCount}`);

console.log("\n=== TOP AGENT (harnesses) ===");
for (const a of lb.agents.slice(0, 14)) console.log(`  #${String(a.rank).padStart(2)} ${a.tier.padEnd(9)} ${p(a.score).padStart(5)}  ${a.harnessId.padEnd(16)} best: ${a.bestModelName} (${a.bestScore}) · ${a.modelsTested} models · [${a.benchmarks.join(",")}]`);

console.log("\n=== TOP LABS ===");
for (const l of lb.labs.slice(0, 12)) console.log(`  #${String(l.rank).padStart(2)} ${l.tier.padEnd(9)} ${p(l.score).padStart(5)}  ${l.vendor.padEnd(14)} best: ${l.bestModelName} · ${l.modelCount} models`);

console.log(`\n=== TOP MODEL · ${lb.meta.defaultHarnessId} ===`);
const board = lb.boards.find((b) => b.harnessId === lb.meta.defaultHarnessId)!;
for (const m of board.models.slice(0, 10)) {
  const cells = Object.entries(m.scores).map(([b, c]) => `${b}=${c.raw}%`).join(" ");
  console.log(`  #${String(m.rank).padStart(2)} ${m.tier.padEnd(9)} ${p(m.composite).padStart(5)}  ${m.modelName.padEnd(26)} ${cells}`);
}

console.log(`\n=== featured harnesses (switcher) ===`);
console.log("  " + lb.harnesses.filter((h) => h.featured).map((h) => h.id).join(", "));
