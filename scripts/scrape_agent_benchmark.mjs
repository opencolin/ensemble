#!/usr/bin/env node
// Scrape every page of https://theagentbenchmark.com/ into a committed JSON
// snapshot (web/src/data/agent-benchmark.json). The site is a static Astro
// build: a sitemap, one ranked homepage (all ~1k agents with subscores inline),
// and one detail page per agent (evidence quotes, sources, news, company info).
//
//   node scripts/scrape_agent_benchmark.mjs [--limit N] [--no-cache]
//
// Raw HTML is cached in .cache/agent-benchmark/ (gitignored) so re-runs only
// fetch what changed. No dependencies; Node 18+.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = "https://theagentbenchmark.com";
const OUT = path.join(ROOT, "web/src/data/agent-benchmark.json");
const CACHE = path.join(ROOT, ".cache/agent-benchmark");
const UA = "Mozilla/5.0 (compatible; ixio-leaderboard/1.0; +https://ixio.com)";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : d;
};
const LIMIT = parseInt(opt("--limit", "0"), 10) || Infinity;
const CONCURRENCY = parseInt(opt("--concurrency", "8"), 10);
const USE_CACHE = !flag("--no-cache");

// ---------- fetch with cache ----------
async function fetchPage(url) {
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const file = path.join(CACHE, key + ".html");
  if (USE_CACHE) {
    try {
      return await readFile(file, "utf8");
    } catch {}
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await writeFile(file, html);
      return html;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function pooled(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

// ---------- html helpers ----------
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
const text = (s) => decode(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
const m1 = (s, re) => {
  const m = s.match(re);
  return m ? decode(m[1].trim()) : undefined;
};
const clip = (s, n = 400) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s);

// ---------- homepage: every ranked agent with subscores ----------
function parseHome(html) {
  const list = html.match(/<ol class="ar-list"[^>]*>(.*?)<\/ol>/s)?.[1] ?? html;
  const rows = list.split(/<li (?=data-cat=)/).slice(1);
  const agents = [];
  for (const row of rows) {
    const slug = m1(row, /href="\/agents\/([^"]+)\/"/);
    if (!slug) continue;
    const parts = {};
    for (const [, part, note, score] of row.matchAll(/title="(Proof|Scale|Momentum|Autonomy): ([^"]*)">(\d+)</g)) {
      parts[part.toLowerCase()] = { score: parseInt(score, 10), note: decode(note) };
    }
    agents.push({
      slug,
      name: m1(row, /class="ar-n"[^>]*>([^<]+)</),
      rank: parseInt(m1(row, /data-r="(\d+)"/) ?? "0", 10),
      risingRank: parseInt(m1(row, /data-rr="(\d+)"/) ?? "0", 10),
      score: parseFloat(m1(row, /title="Score out of 10">([\d.]+)</) ?? "0"),
      market: m1(row, /class="ar-tag"[^>]*>([^<]+)</),
      marketSlug: m1(row, /data-market="([^"]+)"/),
      categorySlug: m1(row, /data-cat="([^"]+)"/),
      maker: m1(row, /data-maker="([^"]+)"/), // yc | startup | big_company
      batch: m1(row, /class="ar-batch"[^>]*>(?:by )?([^<]+)</), // YC batch or company
      description: m1(row, /class="ar-line"[^>]*>(.*?)<\/span>/s),
      parts,
    });
  }
  return agents;
}

// ---------- agent detail page ----------
function parseAgent(html) {
  const a = {};
  a.name = m1(html, /<h1 class="keep-case"[^>]*>([^<]+)</);
  a.description = m1(html, /class="ag-one"[^>]*>(.*?)<\/p>/s);
  a.website = m1(html, /class="ag-site"[^>]*><a href="([^"]+)"/);
  a.market = m1(html, /class="tag strong" href="\/\?market=[^"]+"[^>]*>([^<]+)</);
  a.category = m1(html, /class="tag" href="\/\?category=[^"]+"[^>]*>([^<]+)</);
  const tags = html.match(/<ul class="ag-tags".*?<\/ul>/s)?.[0] ?? "";
  a.ycStatus = m1(tags, /<span class="tag"[^>]*>([^<]+)<\/span>/);
  a.score = parseFloat(m1(html, /class="sc sc-\d+ lg"[^>]*>([\d.]+)</) ?? "0");
  const rank = html.match(/<strong[^>]*>#(\d+)<\/strong>\s*of (\d+) agents/);
  if (rank) [a.rank, a.totalAgents] = [parseInt(rank[1], 10), parseInt(rank[2], 10)];
  const mrank = html.match(/<strong[^>]*>#(\d+)<\/strong>\s*of (\d+) in /);
  if (mrank) [a.marketRank, a.marketSize] = [parseInt(mrank[1], 10), parseInt(mrank[2], 10)];

  // Score parts: summary + every evidence item (points, label, quote, source, date).
  a.parts = {};
  for (const sec of html.split(/<li class="part" id="part-/).slice(1)) {
    const key = sec.match(/^([a-z]+)"/)?.[1];
    if (!key) continue;
    const evidence = [];
    const missing = [...sec.matchAll(/<p class="ev-miss"[^>]*>(.*?)<\/p>/gs)].map(([, s]) =>
      text(s).replace(/^Not found:\s*/, ""),
    );
    for (const li of sec.match(/<ul class="ev"[^>]*>(.*?)<\/ul>/s)?.[1].split(/<li[ >]/).slice(1) ?? []) {
      const pts = m1(li, /class="ev-pts"[^>]*>\+?(-?\d+)</);
      const label = m1(li, /class="ev-label"[^>]*>(.*?)<\/span>/s);
      if (pts === undefined) continue;
      evidence.push({
        pts: parseInt(pts, 10),
        label,
        quote: clip(m1(li, /class="ev-quote"[^>]*>(.*?)<\/blockquote>/s)),
        source: m1(li, /<a href="([^"]+)"[^>]*>Source<\/a>/),
        date: m1(li, />Source<\/a>\s*·\s*([^<]+)</),
      });
    }
    a.parts[key] = {
      score: parseInt(m1(sec, new RegExp(`title="[A-Za-z]+ (\\d+) of 10"`)) ?? "0", 10),
      summary: m1(sec, /class="part-sum"[^>]*>(.*?)<\/p>/s),
      evidence,
      ...(missing.length ? { missing } : {}),
    };
  }

  const about = html.match(/<section id="about".*?<\/section>/s)?.[0];
  if (about) a.about = m1(about, /<p[^>]*>(.*?)<\/p>/s);

  a.news = [...(html.match(/<ol class="tl"[^>]*>(.*?)<\/ol>/s)?.[1] ?? "").matchAll(/<li[^>]*><a href="([^"]+)"[^>]*>.*?class="tag"[^>]*>([^<]+)<\/span><span[^>]*>([^<]+)<\/span><\/span><span class="tl-title"[^>]*>(.*?)<\/span>/gs)]
    .slice(0, 10)
    .map(([, url, kind, date, title]) => ({ kind: decode(kind), date: decode(date), title: decode(title.replace(/<[^>]+>/g, " ").trim()), url }));
  return a;
}

// ---------- main ----------
const sitemap = await fetch(`${SITE}/sitemap.xml`, { headers: { "user-agent": UA } }).then((r) => r.text());
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const agentUrls = urls.filter((u) => u.includes("/agents/")).slice(0, LIMIT);
console.log(`sitemap: ${urls.length} pages (${agentUrls.length} agent pages to scrape)`);

await mkdir(CACHE, { recursive: true });
await mkdir(path.dirname(OUT), { recursive: true });

// Non-agent pages (home carries the full ranked list; the rest are archived for completeness).
const [home, searchJson] = await Promise.all([
  fetchPage(`${SITE}/`),
  fetch(`${SITE}/search.json`, { headers: { "user-agent": UA } }).then((r) => r.json()),
  fetchPage(`${SITE}/database/`),
  fetchPage(`${SITE}/methodology/`),
  fetchPage(`${SITE}/submit/`),
]);
const ranked = parseHome(home);
console.log(`homepage: ${ranked.length} ranked agents`);

let done = 0;
let failed = 0;
const details = await pooled(agentUrls, CONCURRENCY, async (url) => {
  const slug = url.match(/\/agents\/([^/]+)\//)?.[1];
  try {
    const d = parseAgent(await fetchPage(url));
    if (++done % 100 === 0) console.log(`  ${done}/${agentUrls.length} agent pages`);
    return { slug, ...d };
  } catch (e) {
    failed++;
    console.error(`  FAIL ${url}: ${e.message}`);
    return { slug, error: String(e.message) };
  }
});

// Merge: homepage row (ranks, subscore notes) + detail page (evidence, news, website).
const bySlug = new Map(details.map((d) => [d.slug, d]));
const agents = [];
const seen = new Set();
for (const row of ranked) {
  const d = bySlug.get(row.slug) ?? {};
  seen.add(row.slug);
  const parts = {};
  for (const k of ["proof", "scale", "momentum", "autonomy"]) {
    parts[k] = { ...(row.parts[k] ?? {}), ...(d.parts?.[k] ?? {}) };
  }
  agents.push({ ...row, ...d, slug: row.slug, name: row.name ?? d.name, rank: row.rank, score: row.score, parts });
}
// Detail pages with no homepage row (unranked / delisted agents).
for (const d of details) if (d.slug && !seen.has(d.slug)) agents.push(d);

const markets = (searchJson.markets ?? []).map(([name, url, note]) => ({
  name,
  slug: url.match(/market=([^&]+)/)?.[1],
  note,
}));

const out = {
  meta: {
    source: SITE,
    scrapedAt: new Date().toISOString(),
    pages: urls.length,
    rankedAgents: ranked.length,
    agentPages: agentUrls.length,
    failedPages: failed,
    weights: { proof: 0.3, scale: 0.3, momentum: 0.25, autonomy: 0.15 },
    notes: "Each agent is scored 0-10 per part from cited public evidence; score = weighted sum. Scraped from the public site.",
  },
  markets,
  agents,
};
await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
const kb = Math.round(JSON.stringify(out).length / 1024);
console.log(`wrote ${path.relative(ROOT, OUT)} — ${agents.length} agents, ${markets.length} markets, ${kb} KB (${failed} page failures)`);
