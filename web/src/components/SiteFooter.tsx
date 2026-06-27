import type { Leaderboard } from "@/lib/types";
import { Mark } from "@/components/SiteHeader";

export function SiteFooter({ meta }: { meta: Leaderboard["meta"] }) {
  return (
    <footer className="mt-auto border-t border-edge/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2">
            <Mark className="size-4 text-accent" />
            <span className="font-display text-sm font-semibold">ixio</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">interface × compute</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-faint">
            One leaderboard for the coding-agent stack — models, harnesses, and labs —
            aggregated from public benchmarks and refreshed daily.
          </p>
          <p className="mt-3 font-mono text-[11px] text-faint">
            {meta.status === "snapshot" ? "Snapshot (live scrape unavailable) · " : "Live · "}
            updated {meta.scrapedAt.slice(0, 10)} · {meta.totalEntries} results
          </p>
        </div>

        <div className="flex gap-12 font-mono text-[13px]">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wider text-faint">Sources</span>
            {meta.sources.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-dim hover:text-accent">
                <span className={`size-1.5 rounded-full ${s.ok ? "bg-excellent" : "bg-iffy"}`} />
                {s.name}
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wider text-faint">Coverage</span>
            <span className="text-dim">{meta.harnessCount} harnesses</span>
            <span className="text-dim">{meta.modelCount} models</span>
            <span className="text-dim">{meta.benchmarkCount} benchmarks</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
