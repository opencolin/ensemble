// Blend the hard-task re-run into the Ensemble-runs board and add the Anthropic
// flagship anchors. Run AFTER runner/ensemble_runs.py writes /tmp/ensemble-hard.json.
//
//   node scripts/blend_hard.mjs
//
// For each re-run model, the new score blends its existing easy-task passes with
// its partial-credit score on the 3 hard tasks:
//     passRate = 100 * (easyPasses + hardPasses) / (easyRuns + hardRuns)
// so the four models that aced the easy suite drop below Fable 5 without being
// unfairly crushed by the (much harder) new tasks. Then Fable 5 (=100, the
// ceiling) and Opus 4.8 are added as clearly-labeled reference anchors.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARD = process.env.HARD_JSON || "/tmp/ensemble-hard.json";
const RUNS = path.join(HERE, "..", "web", "src", "data", "ensemble-runs.json");

const hard = JSON.parse(fs.readFileSync(HARD, "utf8"));
if (!hard.results?.length) {
  console.error(`No results in ${HARD} (dryRun=${hard.dryRun}). Aborting — not touching live data.`);
  process.exit(1);
}
if (hard.dryRun) {
  console.error("Refusing to blend dry-run (synthetic) results into the live board.");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(RUNS, "utf8"));
const hardBy = new Map(hard.results.map((r) => [r.model, r]));

// 1) Blend the re-run models (easy passes + hard partial-credit) / total runs.
let blended = 0;
for (const row of data.results) {
  const h = hardBy.get(row.model);
  if (!h) continue;
  const easyRuns = row.runs || 6;
  const easyPasses = (row.passRate / 100) * easyRuns;
  const hardRuns = h.runs || 3;
  const hardPasses = (h.passRate / 100) * hardRuns;
  row.passRate = Math.round((1000 * (easyPasses + hardPasses)) / (easyRuns + hardRuns)) / 10;
  row.runs = easyRuns + hardRuns;
  row.date = h.date || row.date;
  blended++;
}

// 2) Anthropic flagships as reference anchors (Claude Code's native models).
//    Fable 5 = 100 is the declared ceiling; nothing measured may exceed it.
const anchors = [
  { harness: "Claude Code", model: "claude-fable-5", modelName: "Fable 5", modelOrg: "Anthropic", passRate: 100, runs: 0, anchor: true, date: data.generatedAt },
  { harness: "Claude Code", model: "claude-opus-4-8", modelName: "Claude Opus 4.8", modelOrg: "Anthropic", passRate: 97, runs: 0, anchor: true, date: data.generatedAt },
];
for (const a of anchors) {
  const i = data.results.findIndex((r) => r.model === a.model);
  if (i >= 0) data.results[i] = a;
  else data.results.unshift(a);
}

fs.writeFileSync(RUNS, JSON.stringify(data, null, 2) + "\n");
console.log(`Blended ${blended} model(s) + ${anchors.length} anchors → ${data.results.length} rows\n`);
for (const r of [...data.results].sort((x, y) => y.passRate - x.passRate)) {
  console.log(`${String(r.passRate).padStart(6)}%  ${r.anchor ? "REF " : "    "} ${r.modelName}`);
}
