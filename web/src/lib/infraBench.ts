// Agent-infrastructure benchmarks (ComputeSDK) — the layer UNDER the coding agent:
// the sandboxes agents execute in, the storage they persist to, and the remote
// browsers they drive. ComputeSDK re-runs these daily in CI and commits raw
// per-iteration results to github.com/computesdk/benchmarks; we read each
// category's latest.json from GitHub raw and aggregate medians server-side.
// (Their site is just a viewer over the same repo data.)

const RAW = "https://raw.githubusercontent.com/computesdk/benchmarks/HEAD";
export const INFRA_SOURCE = {
  repo: "https://github.com/computesdk/benchmarks",
  site: "https://www.computesdk.com/benchmarks",
  author: "ComputeSDK",
};

async function getJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${RAW}/${path}`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function median(xs: number[]): number | null {
  const s = xs.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
}

interface RawRun {
  timestamp?: string;
  config?: { iterations?: number };
  results?: { provider: string; iterations?: Record<string, number>[]; wallClockMs?: number }[];
}

/** provider -> median of `key` across its iterations (null-safe on partial data). */
function medians(run: RawRun | null, key: string): Map<string, { med: number | null; ok: number; total: number }> {
  const out = new Map<string, { med: number | null; ok: number; total: number }>();
  for (const r of run?.results ?? []) {
    const vals = (r.iterations ?? []).map((i) => i?.[key]).filter((v): v is number => typeof v === "number");
    out.set(r.provider, { med: median(vals), ok: vals.length, total: run?.config?.iterations ?? (r.iterations ?? []).length });
  }
  return out;
}

// ---------------------------------------------------------------- sandboxes
export interface SandboxRow {
  provider: string;
  seqMs: number | null; // median time-to-interactive, sequential creates
  burstMs: number | null; // median TTI at 100 concurrent creates
  staggeredMs: number | null; // median TTI, 100 creates at 200ms stagger
  ok: number; // successful sequential iterations
  total: number;
  priceHr: number | null; // $/hr normalized to 1 vCPU + 2 GB
  priceConfidence?: string;
}

export interface SandboxBench {
  updated: string;
  iterations: number;
  rows: SandboxRow[];
}

export async function fetchSandboxBench(): Promise<SandboxBench | null> {
  const [seq, burst, stag, pricing] = await Promise.all([
    getJson("results/sequential_tti/latest.json"),
    getJson("results/burst_tti/latest.json"),
    getJson("results/staggered_tti/latest.json"),
    getJson("pricing.json"),
  ]);
  if (!seq) return null;
  const s = medians(seq as RawRun, "ttiMs");
  const b = medians(burst as RawRun, "ttiMs");
  const g = medians(stag as RawRun, "ttiMs");
  const price = new Map<string, { hr: number; conf?: string }>();
  for (const p of ((pricing as { providers?: { id: string; pricing?: { normalized?: { total_1vcpu_2gb_hr?: number; confidence?: string } } }[] } | null)?.providers ?? [])) {
    const n = p.pricing?.normalized;
    if (typeof n?.total_1vcpu_2gb_hr === "number") price.set(p.id, { hr: n.total_1vcpu_2gb_hr, conf: n.confidence });
  }
  const rows: SandboxRow[] = [...s.entries()].map(([provider, v]) => ({
    provider,
    seqMs: v.med,
    burstMs: b.get(provider)?.med ?? null,
    staggeredMs: g.get(provider)?.med ?? null,
    ok: v.ok,
    total: v.total,
    priceHr: price.get(provider)?.hr ?? null,
    priceConfidence: price.get(provider)?.conf,
  }));
  rows.sort((a, b2) => (a.seqMs ?? Infinity) - (b2.seqMs ?? Infinity));
  return {
    updated: ((seq as RawRun).timestamp ?? "").slice(0, 10),
    iterations: (seq as RawRun).config?.iterations ?? 100,
    rows,
  };
}

// ------------------------------------------------------------------ storage
export interface StorageRow {
  provider: string;
  uploadMs: number | null; // 4MB medians
  downloadMs: number | null;
  mbps: Record<string, number | null>; // size class -> median throughput
}

export interface StorageBench {
  updated: string;
  iterations: number;
  sizes: string[];
  rows: StorageRow[];
}

const STORAGE_SIZES = ["1mb", "4mb", "10mb", "16mb"];

export async function fetchStorageBench(): Promise<StorageBench | null> {
  const runs = await Promise.all(STORAGE_SIZES.map((s2) => getJson(`results/storage/${s2}/latest.json`)));
  const four = runs[STORAGE_SIZES.indexOf("4mb")] as RawRun | null;
  if (!four) return null;
  const up = medians(four, "uploadMs");
  const down = medians(four, "downloadMs");
  const thr = STORAGE_SIZES.map((_, i) => medians(runs[i] as RawRun, "throughputMbps"));
  const providers = [...up.keys()];
  const rows: StorageRow[] = providers.map((provider) => ({
    provider,
    uploadMs: up.get(provider)?.med ?? null,
    downloadMs: down.get(provider)?.med ?? null,
    mbps: Object.fromEntries(STORAGE_SIZES.map((s2, i) => [s2, thr[i].get(provider)?.med ?? null])),
  }));
  rows.sort((a, b) => (b.mbps["4mb"] ?? -1) - (a.mbps["4mb"] ?? -1));
  return { updated: (four.timestamp ?? "").slice(0, 10), iterations: four.config?.iterations ?? 100, sizes: STORAGE_SIZES, rows };
}

// ------------------------------------------------------------------ browsers
export interface BrowserRow {
  provider: string;
  createMs: number | null;
  connectMs: number | null;
  navigateMs: number | null;
  totalMs: number | null; // full session round-trip
  actionsPerSec: number | null; // from the throughput suite
  ok: number;
  total: number;
}

export interface BrowserBench {
  updated: string;
  iterations: number;
  rows: BrowserRow[];
}

export async function fetchBrowserBench(): Promise<BrowserBench | null> {
  const [run, thr] = await Promise.all([
    getJson("results/browser/latest.json"),
    getJson("results/browser-throughput/latest.json"),
  ]);
  if (!run) return null;
  const create = medians(run as RawRun, "createMs");
  const connect = medians(run as RawRun, "connectMs");
  const nav = medians(run as RawRun, "navigateMs");
  const total = medians(run as RawRun, "totalMs");
  const aps = medians(thr as RawRun, "actionsPerSecond");
  const rows: BrowserRow[] = [...total.entries()].map(([provider, v]) => ({
    provider,
    createMs: create.get(provider)?.med ?? null,
    connectMs: connect.get(provider)?.med ?? null,
    navigateMs: nav.get(provider)?.med ?? null,
    totalMs: v.med,
    actionsPerSec: aps.get(provider)?.med ?? null,
    ok: v.ok,
    total: v.total,
  }));
  rows.sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity));
  return { updated: ((run as RawRun).timestamp ?? "").slice(0, 10), iterations: (run as RawRun).config?.iterations ?? 100, rows };
}

/** "cloud-run" -> "Cloud Run", "aws-s3" -> "AWS S3" — display names for provider slugs. */
const NAME_OVERRIDES: Record<string, string> = {
  "aws-s3": "AWS S3", "azure-blob": "Azure Blob", "cloudflare-r2": "Cloudflare R2",
  gcs: "Google Cloud Storage", "vercel-blob": "Vercel Blob", "cloud-run": "Google Cloud Run",
  e2b: "E2B", hopx: "HopX", isorun: "IsoRun", browseruse: "Browser Use", createos: "CreateOS",
};
export function providerName(slug: string): string {
  if (NAME_OVERRIDES[slug]) return NAME_OVERRIDES[slug];
  return slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
