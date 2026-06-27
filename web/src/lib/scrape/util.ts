// Minimal dependency-free HTML helpers for scraping leaderboard tables.

/** Parse the largest <table> in an HTML string into rows of cell text. */
export function parseHtmlTable(html: string): string[][] {
  const tables = [...html.matchAll(/<table[^>]*>(.*?)<\/table>/gs)].map((m) => m[1]);
  if (!tables.length) return [];
  // Pick the table with the most rows (the leaderboard, not layout tables).
  const best = tables
    .map((t) => [...t.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)])
    .sort((a, b) => b.length - a.length)[0];
  return best.map((tr) =>
    [...tr[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((c) =>
      decodeEntities(c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
    ),
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2[0-9a-f];/gi, " ");
}

/** Pull the first percentage and optional ± stderr from "84.7 % ± 2.1". */
export function parsePercent(s: string): { pct: number; stderr?: number } | null {
  const m = s.match(/([\d.]+)\s*%/);
  if (!m) return null;
  const pct = parseFloat(m[1]);
  if (Number.isNaN(pct)) return null;
  const e = s.match(/±\s*([\d.]+)/);
  return { pct, stderr: e ? parseFloat(e[1]) : undefined };
}

export async function fetchText(url: string, timeoutMs = 30000): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; ixio-leaderboard/1.0; +https://ixio.com)" },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(timeoutMs),
  } as RequestInit & { next: { revalidate: number } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}
