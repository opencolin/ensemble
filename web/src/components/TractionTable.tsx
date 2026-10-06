import Link from "next/link";
import type { Benchmark, TractionEntry } from "@/lib/types";
import { Rank, StatBar } from "@/components/bits";

/**
 * Market-traction board on Top Agent: coding-agent products scored by a
 * harness-kind benchmark (The Agent Benchmark, 0–10 from cited public
 * evidence). A different axis than the model boards — "is this agent real
 * in the market", not "which model should drive it".
 */
export function TractionTable({ traction, benchmarks }: { traction: TractionEntry[]; benchmarks: Benchmark[] }) {
  if (!traction.length) return null;
  const bench = benchmarks.find((b) => b.id === traction[0].benchmark);
  const parts = ["proof", "scale", "momentum", "autonomy"] as const;
  const PART_HINT: Record<(typeof parts)[number], string> = {
    proof: "Do customers use it? (30%)",
    scale: "Is there a real company behind it? (30%)",
    momentum: "Is it shipping and growing now? (25%)",
    autonomy: "How much of the job does it do on its own? (15%)",
  };

  // Rank | Agent | Proof | Scale | Momentum | Autonomy | Score
  const grid = "2.5rem minmax(12rem,1fr) 4rem 4rem 5.4rem 5.2rem 10rem";

  return (
    <section id="traction" className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Market traction</h2>
        <span className="shrink-0 font-mono text-xs text-faint">
          {traction.length} coding agents ·{" "}
          {bench && (
            <a href={bench.homepage} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-dim hover:underline">
              {bench.name} ↗
            </a>
          )}
        </span>
      </div>
      <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-faint">
        A different axis than the{" "}
        <Link href="/agents" className="text-dim underline-offset-2 hover:text-accent hover:underline">
          Top Harness
        </Link>{" "}
        boards: not how well a harness drives a model, but whether the shipping product is{" "}
        <span className="text-dim">real in the market</span>. Every coding agent in{" "}
        {bench?.name ?? "the source"}&apos;s Software engineer market, scored 0–10 from cited public
        evidence — proof (customers), scale (company), momentum (shipping), autonomy.
      </p>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 760 }}>
          <div
            className="grid items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint"
            style={{ gridTemplateColumns: grid }}
          >
            <span>#</span>
            <span>Agent</span>
            {parts.map((p) => (
              <span key={p} className="text-right" title={PART_HINT[p]}>
                {p}
              </span>
            ))}
            <span className="text-right">Score / 10</span>
          </div>

          <div className="divide-y divide-edge/50">
            {traction.map((t, i) => (
              <div
                key={t.harnessId}
                className="rise grid items-center gap-x-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface/70"
                style={{ gridTemplateColumns: grid, animationDelay: `${Math.min(i, 12) * 30}ms` }}
              >
                <Rank rank={t.rank} />
                <div className="flex min-w-0 items-baseline gap-2">
                  {t.onBoards ? (
                    <Link href={`/agents/${t.harnessId}`} className="truncate font-display text-[15px] font-medium text-ink underline-offset-2 hover:text-accent">
                      {t.name}
                    </Link>
                  ) : (
                    <span className="truncate font-display text-[15px] font-medium text-ink">{t.name}</span>
                  )}
                  {t.vendor !== "Unknown" && t.vendor !== t.name && (
                    <span className="truncate font-mono text-[11px] text-faint">{t.vendor}</span>
                  )}
                  {t.onBoards && (
                    <span className="shrink-0 rounded border border-accent-dim/40 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-accent/80" title="Also has harness × model scores on our boards">
                      on boards
                    </span>
                  )}
                </div>
                {parts.map((p) => (
                  <span key={p} className="tnum text-right font-mono text-[13px] text-dim">
                    {t.parts?.[p] ?? "—"}
                  </span>
                ))}
                <div className="flex items-center justify-end gap-2.5">
                  <div className="hidden flex-1 sm:block">
                    <StatBar value={t.score / 100} tone="accent" />
                  </div>
                  <span className="tnum w-9 shrink-0 text-right font-display text-base font-semibold text-ink">
                    {(t.score / 10).toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-faint">
        Traction isn&apos;t capability — a well-funded agent can still lose to a scrappy harness on
        the benchmark boards. Agents marked <span className="text-dim">on boards</span> also have
        harness × model scores on{" "}
        <Link href="/agents" className="text-dim underline-offset-2 hover:text-accent hover:underline">
          Top Harness
        </Link>
        .
      </p>
    </section>
  );
}
