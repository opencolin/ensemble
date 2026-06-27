import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeaderboard } from "@/lib/leaderboard";
import { allTeamSlugs, vendorForSlug, getLab, teamModels, slugFor } from "@/lib/select";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Rank, StatBar, TierChip, OpenWeightBadge, TIER_CLASS } from "@/components/bits";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  const lb = await getLeaderboard();
  return allTeamSlugs(lb).map((vendor) => ({ vendor }));
}

export async function generateMetadata({ params }: { params: Promise<{ vendor: string }> }): Promise<Metadata> {
  const { vendor: slug } = await params;
  const lb = await getLeaderboard();
  const vendor = vendorForSlug(lb, slug);
  if (!vendor) return { title: "Team not found — ixio" };
  return { title: `${vendor} — ixio`, description: `Every ${vendor} model, ranked by composite across public benchmarks.` };
}

function Stat({ k, v, cls = "text-ink" }: { k: string; v: string; cls?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className={`tnum font-display text-4xl font-semibold ${cls}`}>{v}</span>
    </div>
  );
}

const GRID = "grid-cols-[2.5rem_minmax(11rem,1fr)_minmax(8rem,1fr)_9rem]";

export default async function TeamPage({ params }: { params: Promise<{ vendor: string }> }) {
  const { vendor: slug } = await params;
  const lb = await getLeaderboard();
  const vendor = vendorForSlug(lb, slug);
  if (!vendor) notFound();
  const lab = getLab(lb, vendor);
  const models = teamModels(lb, vendor);
  const benchName = (id: string) => lb.benchmarks.find((b) => b.id === id)?.name ?? id;
  const benchUnit = (id: string) => lb.benchmarks.find((b) => b.id === id)?.unit ?? "pct";
  const fmt = (id: string, raw: number) => (benchUnit(id) === "pct" ? `${raw}%` : `${raw}`);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-10">
          <Link href="/team" className="font-mono text-xs text-faint hover:text-dim">
            ← Top Team
          </Link>

          <div className="mt-5 flex flex-col gap-6 border-b border-edge/70 pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {lab && <TierChip tier={lab.tier} />}
                {lab?.openWeight && <OpenWeightBadge />}
              </div>
              <h1 className="font-display text-4xl font-semibold tracking-tight">{vendor}</h1>
              <div className="mt-3 font-mono text-[13px] text-faint">
                {models.length} models · best:{" "}
                <Link href={`/models/${slugFor(models[0]?.modelId ?? "")}`} className="text-dim hover:text-accent">
                  {models[0]?.modelName}
                </Link>
              </div>
            </div>
            {lab && (
              <div className="flex items-end gap-8">
                <Stat k="Team rank" v={`#${lab.rank}`} cls={TIER_CLASS[lab.tier].text} />
                <Stat k="Score" v={lab.score.toFixed(1)} />
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {vendor} models <span className="ml-1 font-mono text-sm font-normal text-faint">· ranked</span>
            </h2>
            <span className="font-mono text-xs text-faint">{models.length} models · composite 0–100</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className={`grid ${GRID} items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint`}>
                <span>#</span>
                <span>Model</span>
                <span>Best result</span>
                <span className="text-right">Composite</span>
              </div>
              <div className="divide-y divide-edge/50">
                {models.map((m, i) => (
                  <Link
                    key={m.modelId}
                    href={`/models/${slugFor(m.modelId)}`}
                    className={`rise grid ${GRID} items-center gap-x-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface/70`}
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  >
                    <Rank rank={i + 1} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-[15px] font-medium text-ink">{m.modelName}</span>
                        <span className={`size-1.5 shrink-0 rounded-full ${TIER_CLASS[m.tier].bar}`} />
                      </div>
                      {m.openWeight && (
                        <div className="font-mono text-[11px] text-faint">
                          <OpenWeightBadge />
                        </div>
                      )}
                    </div>
                    <span className="truncate font-mono text-[12px] text-dim">
                      {m.best ? `${benchName(m.best.benchmark)} · ${fmt(m.best.benchmark, m.best.raw)}` : "—"}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <div className="hidden flex-1 sm:block">
                        <StatBar value={m.composite / 100} tone={m.tier} />
                      </div>
                      <span className="tnum w-9 shrink-0 text-right font-display text-base font-semibold text-ink">
                        {m.composite.toFixed(0)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}
