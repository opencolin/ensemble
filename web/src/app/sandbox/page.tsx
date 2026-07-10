import type { Metadata } from "next";
import { getLeaderboard } from "@/lib/leaderboard";
import { fetchSandboxBench, INFRA_SOURCE } from "@/lib/infraBench";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Rank } from "@/components/bits";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Sandbox — ixio",
  description:
    "Which sandbox spins up fastest for your agent? Providers ranked by ComputeSDK's composite score — cold-start latency × reliability — re-measured daily.",
};

function MetaChip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className="font-mono text-[13px] text-dim">{v}</span>
    </div>
  );
}

const ms = (v: number | null) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`);

export default async function SandboxPage() {
  const [lb, bench] = await Promise.all([getLeaderboard(), fetchSandboxBench()]);
  const GRID = "grid-cols-[2.5rem_minmax(9rem,1fr)_5.6rem_5rem_4.6rem_5.4rem_5.6rem_4.6rem_4.6rem]";

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            AGENT INFRASTRUCTURE · sandboxes
          </div>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Which sandbox spins up <span className="text-accent">fastest?</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            Every coding agent needs an isolated box to execute in — and cold-start latency is the
            tax on every task. This ranks sandbox providers by ComputeSDK&apos;s{" "}
            <span className="text-ink">composite score</span> — cold-start latency percentiles
            blended with reliability — re-measured daily in their open CI.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-4">
            <MetaChip k="Providers" v={`${bench?.rows.length ?? "—"}`} />
            <MetaChip k="Runs per provider" v={`${bench?.iterations ?? "—"} per mode`} />
            <MetaChip k="Measured" v={bench?.updated ?? "—"} />
            <MetaChip k="Cadence" v="daily · open CI" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Sandboxes
              <span className="ml-2 font-mono text-sm font-normal text-faint">· ranked by composite score</span>
            </h2>
            <a href={`${INFRA_SOURCE.site}/sandboxes/`} target="_blank" rel="noreferrer" className="font-mono text-xs text-faint hover:text-accent">
              source: {INFRA_SOURCE.author} benchmarks ↗
            </a>
          </div>

          {!bench ? (
            <p className="rounded-xl border border-edge bg-surface/40 px-5 py-10 text-center font-mono text-[13px] text-faint">
              Live data unavailable right now — the daily refresh will retry.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                <div className={`grid ${GRID} items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint`}>
                  <span>#</span>
                  <span>Provider</span>
                  <span className="text-right" title="ComputeSDK's composite: latency percentiles × reliability (0–100)">Composite</span>
                  <span className="text-right" title="Median TTI, one create at a time">Median</span>
                  <span className="text-right" title="95th-percentile TTI">P95</span>
                  <span className="text-right" title="Median TTI at 100 concurrent creates">Burst ×100</span>
                  <span className="text-right" title="Median TTI, 100 creates at 200ms intervals">Staggered</span>
                  <span className="text-right" title="Successful runs">Success</span>
                  <span className="text-right" title="Normalized to 1 vCPU + 2 GB RAM">$/hr</span>
                </div>
                <div className="divide-y divide-edge/50">
                  {bench.rows.map((r, i) => (
                    <div key={r.provider} className={`rise grid ${GRID} items-center gap-x-3 rounded-lg px-3 py-3 ${i === 0 ? "bg-accent/[0.04]" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                      <Rank rank={i + 1} />
                      <span className="truncate font-display text-[15px] font-medium text-ink">{r.provider}</span>
                      <span className="tnum text-right font-display text-[15px] font-semibold text-ink">{r.score.toFixed(1)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{ms(r.medMs)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{ms(r.p95Ms)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{ms(r.burstMs)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{ms(r.staggeredMs)}</span>
                      <span className="tnum text-right font-mono text-[12px] text-faint">{r.successPct == null ? "—" : `${r.successPct}%`}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">
                        {r.priceHr == null ? "—" : `$${r.priceHr.toFixed(r.priceHr < 0.1 ? 3 : 2)}`}
                        {r.priceHr != null && r.priceConfidence !== "exact" && <sup className="ml-0.5 text-[9px] text-faint">est</sup>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-edge bg-surface/40 p-5">
              <div className="font-display text-base font-semibold text-ink">How it&apos;s measured</div>
              <p className="mt-2 text-[13px] leading-relaxed text-faint">
                The composite is ComputeSDK&apos;s headline score: cold-start latency percentiles
                blended with reliability, so a provider can&apos;t top the board on a degenerate run.
                TTI = create a sandbox, execute a command, wait for the answer. Burst (100 at once)
                and staggered (100 at 200&nbsp;ms intervals) medians come from the raw repo data;
                prices normalized to 1&nbsp;vCPU + 2&nbsp;GB.
              </p>
            </div>
            <div className="rounded-xl border border-edge bg-surface/40 p-5">
              <div className="font-display text-base font-semibold text-ink">Independent &amp; re-run daily</div>
              <p className="mt-2 text-[13px] leading-relaxed text-faint">
                Run by {INFRA_SOURCE.author} (a provider-neutral SDK) in public GitHub CI — raw
                per-iteration results are committed to the open repo, and this page reads them
                straight from it. Related: the sandboxes agents{" "}
                <a href={INFRA_SOURCE.repo} target="_blank" rel="noreferrer" className="text-dim underline-offset-2 hover:text-accent hover:underline">store</a>{" "}
                to and the browsers they drive, on the Storage and Browser boards.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}
