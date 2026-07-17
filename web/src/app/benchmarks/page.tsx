import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard";
import { BENCHMARK_CRITERIA } from "@/lib/types";
import { fetchSandboxBench, fetchStorageBench, fetchBrowserBench, INFRA_SOURCE } from "@/lib/infraBench";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Rank, StatBar } from "@/components/bits";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Top Benchmark — ixio",
  description: "We rank the benchmarks themselves by how directly they measure the coding-agent stack.",
};

const GRID = "grid-cols-[2.5rem_minmax(11rem,1fr)_4.2rem_4.6rem_4.2rem_3.8rem_7rem]";

export default async function BenchmarksPage() {
  const [lb, sbx, sto, bro] = await Promise.all([
    getLeaderboard(), fetchSandboxBench(), fetchStorageBench(), fetchBrowserBench(),
  ]);
  const ranking = lb.benchmarkRanking;
  const infra = [
    { name: "ComputeSDK Sandboxes", what: "Sandbox cold-start: median time-to-interactive (sequential / burst / staggered) + $/hr", n: sbx?.rows.length, href: "/sandbox", src: `${INFRA_SOURCE.site}/sandboxes/` },
    { name: "ComputeSDK Storage", what: "Object-storage throughput and latency on real 1–16 MB transfers", n: sto?.rows.length, href: "/storage", src: `${INFRA_SOURCE.site}/storage/` },
    { name: "ComputeSDK Browsers", what: "Remote-browser session round-trip (create · connect · navigate) + actions/s", n: bro?.rows.length, href: "/browser", src: `${INFRA_SOURCE.site}/browsers/` },
  ];

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            RANKING THE RANKINGS · benchmarks
          </div>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Which benchmark should you{" "}
            <span className="text-accent">trust?</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            Every leaderboard here pulls from public benchmarks — but they&apos;re not equal. We rank
            them by one thing: how directly they measure the{" "}
            <span className="text-ink">coding-agent stack</span> — a real harness driving a real
            model on real tasks. Four criteria, weighted:
          </p>

          {/* the test */}
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BENCHMARK_CRITERIA.map((c) => (
              <div key={c.key} className="rounded-xl border border-edge bg-surface/50 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-sm font-semibold text-ink">{c.label}</span>
                  <span className="font-mono text-xs text-accent">{Math.round(c.weight * 100)}%</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-faint">{c.blurb}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ranking */}
        <section className="mx-auto max-w-6xl px-5 py-4">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">Benchmark leaderboard</h2>
            <span className="font-mono text-xs text-faint">{ranking.length} benchmarks · score 0–100</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className={`grid ${GRID} items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint`}>
                <span>#</span>
                <span>Benchmark</span>
                <span className="text-right" title="Scores a real harness × model pair">Agent</span>
                <span className="text-right" title="Breadth of agent × model combinations">Coverage</span>
                <span className="text-right" title="Executable real-world tasks">Realism</span>
                <span className="text-right" title="Open data + receipts">Open</span>
                <span className="text-right">Score</span>
              </div>
              <div className="divide-y divide-edge/50">
                {ranking.map((b, i) => (
                  <div key={b.id} className={`rise grid ${GRID} items-center gap-x-3 rounded-lg px-3 py-3 ${b.rank === 1 ? "bg-accent/[0.04]" : ""}`} style={{ animationDelay: `${i * 35}ms` }}>
                    <Rank rank={b.rank} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <a href={b.source} target="_blank" rel="noreferrer" className="truncate font-display text-[15px] font-medium text-ink hover:text-accent">
                          {b.name}
                        </a>
                        <span className={`shrink-0 rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${b.kind === "agent" ? "border-accent-dim/40 text-accent/80" : "border-edge text-faint"}`}>
                          {b.kind}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-faint">
                        {b.kind === "agent" ? `${b.pairs} agent×model pairs${b.evaluations > b.pairs ? ` · ${b.evaluations.toLocaleString()} runs` : ""}` : `${b.modelCount} models`} · {b.metric}
                      </span>
                    </div>
                    <Crit v={b.agentNative} />
                    <Crit v={b.coverage} />
                    <Crit v={b.realism} />
                    <Crit v={b.openness} />
                    <div className="flex items-center gap-2.5">
                      <div className="hidden flex-1 sm:block">
                        <StatBar value={b.score / 100} tone="accent" />
                      </div>
                      <span className="tnum w-9 shrink-0 text-right font-display text-base font-semibold text-ink">{b.score.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-faint">
            {ranking[0] && (
              <>
                <span className="text-dim">{ranking[0].name}</span>{" "}
                tops it — the broadest open matrix of coding agents × open-weight models on
                executable tasks, with public per-run receipts. Model-level benchmarks never drive a
                harness, so they rank lower — but an executable, traced contest where models write real
                code holds up far better than human-preference Elo or aggregate indexes, which sink furthest.
              </>
            )}
          </p>
        </section>

        {/* infrastructure benchmarks — a different axis, so not in the ranking above */}
        <section className="mx-auto max-w-6xl px-5 py-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Infrastructure benchmarks</h2>
            <a href={INFRA_SOURCE.site} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-xs text-faint hover:text-accent">
              source: {INFRA_SOURCE.author} ↗
            </a>
          </div>
          <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-faint">
            These measure the layer <span className="text-dim">under</span> the agent — the sandboxes
            it executes in, the storage it persists to, the browsers it drives — so they rank{" "}
            <span className="text-dim">providers</span>, not models, and sit outside the scoring
            above. Run daily in {INFRA_SOURCE.author}&apos;s open CI; we read the raw results
            straight from the repo.
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {infra.map((b) => (
              <div key={b.name} className="flex flex-col gap-2 rounded-xl border border-edge bg-surface/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[15px] font-medium text-ink">{b.name}</span>
                  <span className="shrink-0 rounded border border-edge px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-faint">infra</span>
                </div>
                <p className="text-[12px] leading-relaxed text-faint">{b.what}</p>
                <div className="mt-auto flex items-center justify-between pt-1 font-mono text-[11px]">
                  <span className="text-faint">{b.n ?? "—"} providers · daily</span>
                  <span className="flex items-center gap-3">
                    <Link href={b.href} className="text-dim hover:text-accent">board →</Link>
                    <a href={b.src} target="_blank" rel="noreferrer" className="text-faint hover:text-accent">src ↗</a>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}

function Crit({ v }: { v: number }) {
  return <span className="tnum text-right font-mono text-[13px] text-dim">{v.toFixed(0)}</span>;
}
