import type { Leaderboard } from "@/lib/types";

const STEPS = [
  { n: "01", t: "Aggregate public leaderboards", d: "We scrape established benchmark leaderboards daily and normalize their messy model and harness names into one dataset." },
  { n: "02", t: "Split agent vs model", d: "Agent benchmarks score a (harness, model) pair; model benchmarks score the raw model. That split is what lets us rank harnesses and labs separately." },
  { n: "03", t: "Three rankings, one dataset", d: "Top Model (best model per harness), Top Agent (the harnesses), and Top Team (each team by its single best model)." },
];

export function Methodology({ lb }: { lb: Leaderboard }) {
  return (
    <section id="method" className="mx-auto max-w-6xl px-5 py-12">
      <div className="mb-8 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">How it works</h2>
        <span className="font-mono text-xs text-faint">updated {lb.meta.scrapedAt.slice(0, 10)}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border border-edge bg-surface/50 p-5">
            <div className="font-mono text-xs text-accent">{s.n}</div>
            <div className="mt-2 font-display text-base font-semibold text-ink">{s.t}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-dim">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        {/* sources */}
        <div className="rounded-xl border border-edge bg-surface/50 p-5">
          <span className="text-[10px] uppercase tracking-wider text-faint">Benchmarks scraped</span>
          <div className="mt-4 flex flex-col divide-y divide-edge/60">
            {lb.benchmarks.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <a href={b.source} target="_blank" rel="noreferrer" className="font-mono text-[13px] font-medium text-ink hover:text-accent">
                      {b.name}
                    </a>
                    <span className="rounded border border-edge px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-faint">
                      {b.kind}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-faint">{b.blurb}</p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-dim">{b.metric}</span>
              </div>
            ))}
          </div>
        </div>

        {/* scoring */}
        <div className="rounded-xl border border-edge bg-surface/50 p-5">
          <span className="text-[10px] uppercase tracking-wider text-faint">Scoring</span>
          <ul className="mt-4 flex flex-col gap-3 text-[13px] leading-relaxed text-dim">
            <li>
              <span className="text-ink">Cells</span>{" "}
              show each benchmark&apos;s own headline number — % resolved, accuracy, and so on.
            </li>
            <li>
              <span className="text-ink">Composite</span>{" "}
              is percentile-blended across a model&apos;s benchmarks, so a 60% on a hard benchmark isn&apos;t unfairly beaten by an 80% on an easy one.
            </li>
            <li>
              <span className="text-ink">Tiers</span>{" "}
              follow the field: top 25% excellent, bottom 40% iffy, the rest solid.
            </li>
            <li className="text-faint">
              Numbers are exactly what the sources report. We aggregate and attribute — we don&apos;t re-run anything.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
