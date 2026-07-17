import type { Metadata } from "next";
import { getLeaderboard } from "@/lib/leaderboard";
import { fetchBrowserBench, providerName, INFRA_SOURCE } from "@/lib/infraBench";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Rank } from "@/components/bits";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Browser — ixio",
  description:
    "Which remote browser is fastest for your agent? Providers ranked by median session round-trip (create, connect, navigate) and actions per second — re-measured daily.",
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

export default async function BrowserPage() {
  const [lb, bench] = await Promise.all([getLeaderboard(), fetchBrowserBench()]);
  const GRID = "grid-cols-[2.5rem_minmax(9rem,1fr)_5rem_5.2rem_5.4rem_5rem_5.6rem_4.6rem]";

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            AGENT INFRASTRUCTURE · remote browsers
          </div>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Which browser drives the web <span className="text-accent">fastest?</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            Agents that browse — scraping, testing, filling forms — rent headless browsers by the
            session. This ranks providers by the{" "}
            <span className="text-ink">median session round-trip</span>: create a browser, connect
            over CDP, load a page, release. Re-measured daily in ComputeSDK&apos;s open CI.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-4">
            <MetaChip k="Providers" v={`${bench?.rows.length ?? "—"}`} />
            <MetaChip k="Runs per provider" v={`${bench?.iterations ?? "—"}`} />
            <MetaChip k="Measured" v={bench?.updated ?? "—"} />
            <MetaChip k="Cadence" v="daily · open CI" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Browsers
              <span className="ml-2 font-mono text-sm font-normal text-faint">· ranked by session round-trip</span>
            </h2>
            <a href={`${INFRA_SOURCE.site}/browsers/`} target="_blank" rel="noreferrer" className="font-mono text-xs text-faint hover:text-accent">
              source: {INFRA_SOURCE.author} benchmarks ↗
            </a>
          </div>

          {!bench ? (
            <p className="rounded-xl border border-edge bg-surface/40 px-5 py-10 text-center font-mono text-[13px] text-faint">
              Live data unavailable right now — the daily refresh will retry.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className={`grid ${GRID} items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint`}>
                  <span>#</span>
                  <span>Provider</span>
                  <span className="text-right" title="Median time to create a session">Create</span>
                  <span className="text-right" title="Median time to attach over CDP">Connect</span>
                  <span className="text-right" title="Median first page load">Navigate</span>
                  <span className="text-right" title="Median full session round-trip">Total</span>
                  <span className="text-right" title="Median actions per second (10-action workload)">Actions/s</span>
                  <span className="text-right" title="Successful runs">Success</span>
                </div>
                <div className="divide-y divide-edge/50">
                  {bench.rows.map((r, i) => (
                    <div key={r.provider} className={`rise grid ${GRID} items-center gap-x-3 rounded-lg px-3 py-3 ${i === 0 ? "bg-accent/[0.04]" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                      <Rank rank={i + 1} />
                      <span className="truncate font-display text-[15px] font-medium text-ink">{providerName(r.provider)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{ms(r.createMs)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{ms(r.connectMs)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{ms(r.navigateMs)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-ink">{ms(r.totalMs)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{r.actionsPerSec == null ? "—" : r.actionsPerSec.toFixed(1)}</span>
                      <span className="tnum text-right font-mono text-[12px] text-faint">{r.ok}/{r.total}</span>
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
                Each iteration creates a fresh session, connects over CDP, loads a page, and
                releases — the cold path an agent pays on every browsing task. Actions/s comes from
                a separate 10-action workload (navigate, click, type, extract) per session. Medians
                over {bench?.iterations ?? 100} runs.
              </p>
            </div>
            <div className="rounded-xl border border-edge bg-surface/40 p-5">
              <div className="font-display text-base font-semibold text-ink">Independent &amp; re-run daily</div>
              <p className="mt-2 text-[13px] leading-relaxed text-faint">
                Run by {INFRA_SOURCE.author} in public GitHub CI; raw per-iteration results live in the{" "}
                <a href={INFRA_SOURCE.repo} target="_blank" rel="noreferrer" className="text-dim underline-offset-2 hover:text-accent hover:underline">open repo</a>{" "}
                this page reads from. See also the Sandbox and Storage boards for the rest of the
                agent-infrastructure stack.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}
