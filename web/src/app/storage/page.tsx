import type { Metadata } from "next";
import { getLeaderboard } from "@/lib/leaderboard";
import { fetchStorageBench, providerName, INFRA_SOURCE } from "@/lib/infraBench";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Rank } from "@/components/bits";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Storage — ixio",
  description:
    "Which object storage moves your agent's files fastest? Providers ranked by median throughput across 1–16 MB objects — re-measured daily.",
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
const mbps = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);

export default async function StoragePage() {
  const [lb, bench] = await Promise.all([getLeaderboard(), fetchStorageBench()]);
  const GRID = "grid-cols-[2.5rem_minmax(9.5rem,1fr)_5.2rem_5.2rem_4.4rem_4.4rem_4.6rem_4.6rem]";

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            AGENT INFRASTRUCTURE · object storage
          </div>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Which storage moves files <span className="text-accent">fastest?</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            Agents constantly shuttle artifacts — repos, build outputs, snapshots — through object
            storage. This ranks providers by <span className="text-ink">median throughput</span> on
            real uploads and downloads at 1–16&nbsp;MB object sizes, re-measured daily in
            ComputeSDK&apos;s open CI.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-4">
            <MetaChip k="Providers" v={`${bench?.rows.length ?? "—"}`} />
            <MetaChip k="Object sizes" v="1 · 4 · 10 · 16 MB" />
            <MetaChip k="Measured" v={bench?.updated ?? "—"} />
            <MetaChip k="Cadence" v="daily · open CI" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Storage
              <span className="ml-2 font-mono text-sm font-normal text-faint">· ranked by 4 MB throughput</span>
            </h2>
            <a href={`${INFRA_SOURCE.site}/storage/`} target="_blank" rel="noreferrer" className="font-mono text-xs text-faint hover:text-accent">
              source: {INFRA_SOURCE.author} benchmarks ↗
            </a>
          </div>

          {!bench ? (
            <p className="rounded-xl border border-edge bg-surface/40 px-5 py-10 text-center font-mono text-[13px] text-faint">
              Live data unavailable right now — the daily refresh will retry.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[740px]">
                <div className={`grid ${GRID} items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint`}>
                  <span>#</span>
                  <span>Provider</span>
                  <span className="text-right" title="Median 4MB upload">Upload</span>
                  <span className="text-right" title="Median 4MB download">Download</span>
                  <span className="text-right" title="Median throughput, 1MB objects (Mbps)">1 MB</span>
                  <span className="text-right" title="Median throughput, 4MB objects (Mbps)">4 MB</span>
                  <span className="text-right" title="Median throughput, 10MB objects (Mbps)">10 MB</span>
                  <span className="text-right" title="Median throughput, 16MB objects (Mbps)">16 MB</span>
                </div>
                <div className="divide-y divide-edge/50">
                  {bench.rows.map((r, i) => (
                    <div key={r.provider} className={`rise grid ${GRID} items-center gap-x-3 rounded-lg px-3 py-3 ${i === 0 ? "bg-accent/[0.04]" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                      <Rank rank={i + 1} />
                      <span className="truncate font-display text-[15px] font-medium text-ink">{providerName(r.provider)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{ms(r.uploadMs)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{ms(r.downloadMs)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{mbps(r.mbps["1mb"])}</span>
                      <span className="tnum text-right font-mono text-[13px] text-ink">{mbps(r.mbps["4mb"])}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{mbps(r.mbps["10mb"])}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{mbps(r.mbps["16mb"])}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <p className="mt-3 font-mono text-[11px] text-faint">Throughput columns in Mbps (median) · upload/download at 4 MB.</p>

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-edge bg-surface/40 p-5">
              <div className="font-display text-base font-semibold text-ink">How it&apos;s measured</div>
              <p className="mt-2 text-[13px] leading-relaxed text-faint">
                Each run uploads and downloads real objects at four sizes against each provider&apos;s
                production API, ~{bench?.iterations ?? 100} iterations per size class, and records
                per-transfer latency and throughput. We show medians — the transfer speed an agent
                actually gets, not a burst peak.
              </p>
            </div>
            <div className="rounded-xl border border-edge bg-surface/40 p-5">
              <div className="font-display text-base font-semibold text-ink">Independent &amp; re-run daily</div>
              <p className="mt-2 text-[13px] leading-relaxed text-faint">
                Run by {INFRA_SOURCE.author} in public GitHub CI; raw per-iteration results live in the{" "}
                <a href={INFRA_SOURCE.repo} target="_blank" rel="noreferrer" className="text-dim underline-offset-2 hover:text-accent hover:underline">open repo</a>{" "}
                this page reads from. See also the Sandbox and Browser boards for the rest of the
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
