import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Benchmark, ScoreCell } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { getLeaderboard } from "@/lib/leaderboard";
import {
  allModelIds,
  modelIdForSlug,
  getModelProfile,
  harnessAppearances,
  slugFor,
} from "@/lib/select";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatBar, TierChip, OpenWeightBadge, TIER_CLASS } from "@/components/bits";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  const lb = await getLeaderboard();
  // Prerender the top models; the long tail renders on demand (dynamicParams).
  return allModelIds(lb).slice(0, 150).map((id) => ({ id: slugFor(id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lb = await getLeaderboard();
  const modelId = modelIdForSlug(lb, id);
  const profile = modelId ? getModelProfile(lb, modelId) : undefined;
  if (!profile) return { title: "Model not found — ixio" };
  return {
    title: `${profile.modelName} — ixio`,
    description: `${profile.modelName} profiled across benchmarks and the harnesses that ran it.`,
  };
}

/** Format a score cell by its benchmark unit. */
function fmtValue(b: Benchmark, cell: ScoreCell): string {
  return b.unit === "pct" ? `${cell.raw}%` : `${cell.raw}`;
}

/** Sub line for a benchmark card: metric, then date and ± stderr when present. */
function cellSub(b: Benchmark, cell: ScoreCell): string {
  const parts = [b.metric];
  if (cell.date) parts.push(cell.date);
  if (cell.stderr !== undefined) parts.push(`± ${cell.stderr}`);
  return parts.join(" · ");
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lb = await getLeaderboard();
  const modelId = modelIdForSlug(lb, id);
  if (!modelId) notFound();
  const profile = getModelProfile(lb, modelId)!;
  const rows = harnessAppearances(lb, modelId);

  const benches = lb.benchmarks.filter((b) => profile.scores[b.id]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <Link href="/" className="font-mono text-xs text-faint hover:text-dim">
          ← Leaderboard
        </Link>

        {/* header */}
        <div className="mt-5 flex flex-col gap-6 border-b border-edge/70 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <TierChip tier={profile.tier} />
              {profile.openWeight && <OpenWeightBadge />}
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight">{profile.modelName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[13px] text-faint">
              <Link href={`/team/${slugFor(profile.vendor)}`} className="text-dim hover:text-accent">{profile.vendor}</Link>
              <span className="text-edge2">·</span>
              <span>{profile.modelId}</span>
            </div>
          </div>

          <div className="flex items-end gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-faint">Rank · overall</span>
              <span className={`tnum font-display text-4xl font-semibold ${TIER_CLASS[profile.tier].text}`}>
                #{profile.rank}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-faint">Score</span>
              <span className="tnum font-display text-4xl font-semibold text-ink">{profile.composite.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* benchmark scores */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">Benchmark scores</h2>
            <span className="font-mono text-xs text-faint">{benches.length} benchmarks</span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {benches.map((b) => {
              const cell = profile.scores[b.id];
              return (
                <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-edge bg-surface/50 p-4">
                  <span className="text-[10px] uppercase tracking-wider text-faint">{b.name}</span>
                  <span className="tnum font-display text-2xl font-semibold text-ink">{fmtValue(b, cell)}</span>
                  {b.unit === "pct" && <StatBar value={cell.raw / 100} tone="accent" />}
                  <span className="font-mono text-[11px] text-faint">{cellSub(b, cell)}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* across harnesses */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">Across harnesses</h2>
            <span className="font-mono text-xs text-faint">{rows.length} agents</span>
          </div>
          {rows.length ? (
            <div className="overflow-hidden rounded-xl border border-edge">
              {rows.map((r, i) => (
                <Link
                  key={r.harness.id}
                  href={`/agents/${r.harness.id}`}
                  className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-surface/70 ${
                    i > 0 ? "border-t border-edge/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[15px] font-medium text-ink">{r.harness.name}</span>
                    <span className="rounded border border-edge px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-faint">
                      {KIND_LABEL[r.harness.kind]}
                    </span>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-3 font-mono text-[13px] text-dim">
                      {benches.map((b) => (
                        <span key={b.id} className="tnum text-right">
                          {r.entry.scores[b.id] ? `${r.entry.scores[b.id].raw}%` : "—"}
                        </span>
                      ))}
                    </div>
                    <span className="tnum w-12 text-right font-display text-base font-semibold text-ink">
                      {r.entry.composite.toFixed(0)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-edge bg-surface/50 px-4 py-4 font-mono text-[13px] text-faint">
              This model appears only in model-level benchmarks — no harness ran it directly.
            </p>
          )}
          {rows.length > 0 && (
            <p className="mt-2 font-mono text-[11px] text-faint">
              Per-benchmark score · composite per harness. Tap a row to open that board.
            </p>
          )}
        </section>

        <p className="mt-8 font-mono text-[11px] text-faint">
          Scraped and aggregated from public leaderboards · {lb.meta.scrapedAt.slice(0, 10)}
        </p>
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}
