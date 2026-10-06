import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TractionTable } from "@/components/TractionTable";
import { Rank } from "@/components/bits";
import tab from "@/data/agent-benchmark.json";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Top Agent — ixio",
  description:
    "Which AI agents are real in the market? Shipping agent products scored 0–10 on cited public evidence (The Agent Benchmark) — coding agents first, every market below.",
};

// The committed full-site snapshot (scripts/scrape_agent_benchmark.mjs).
interface TabAgent {
  slug: string;
  name?: string;
  rank?: number;
  score?: number;
  market?: string;
  maker?: string; // yc | startup | big_company
  batch?: string; // YC batch, or the company for big_company rows
  website?: string;
  parts?: Record<string, { score?: number }>;
}
interface TabData {
  meta: { scrapedAt: string; rankedAgents: number };
  markets: { name: string }[];
  agents: TabAgent[];
}

function MetaChip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className="font-mono text-[13px] text-dim">{v}</span>
    </div>
  );
}

const PARTS = ["proof", "scale", "momentum", "autonomy"] as const;

export default async function TopAgentsPage() {
  const lb = await getLeaderboard();
  const data = tab as unknown as TabData;
  const all = data.agents.filter((a) => a.rank && a.score != null).sort((a, b) => a.rank! - b.rank!);
  const top = all.slice(0, 30);

  // Rank | Agent | Market | Proof | Scale | Momentum | Autonomy | Score
  const grid = "2.5rem minmax(11rem,1.2fr) minmax(8rem,1fr) 4rem 4rem 5.4rem 5.2rem 4.4rem";

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-9">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            SHIPPING AGENTS · market traction
          </div>

          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Which AI agents are <span className="text-accent">real?</span>
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            Benchmarks measure capability; this page measures <span className="text-ink">reality</span>.{" "}
            <a href="https://theagentbenchmark.com/" target="_blank" rel="noreferrer" className="text-ink underline-offset-2 hover:text-accent hover:underline">
              The Agent Benchmark
            </a>{" "}
            scores ~1,000 shipping agent products 0–10 from cited public evidence:{" "}
            <span className="text-ink">proof</span> (do customers use it? 30%),{" "}
            <span className="text-ink">scale</span> (is there a real company behind it? 30%),{" "}
            <span className="text-ink">momentum</span> (is it shipping now? 25%) and{" "}
            <span className="text-ink">autonomy</span> (how much of the job does it own? 15%). We
            scrape its coding agents live, and snapshot the full database.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-edge bg-surface/40 px-5 py-3 text-[13px] text-faint">
            Four rankings off one dataset:{" "}
            <Link href="/leaderboard" className="text-dim underline-offset-2 hover:text-accent hover:underline">
              Top Model
            </Link>
            {" · "}
            <Link href="/agents" className="text-dim underline-offset-2 hover:text-accent hover:underline">
              Top Harness
            </Link>
            {" · "}
            <span className="text-ink">Top Agent</span>
            {" · "}
            <Link href="/team" className="text-dim underline-offset-2 hover:text-accent hover:underline">
              Top Lab
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-4">
            <MetaChip k="Agents scored" v={`${data.meta.rankedAgents}`} />
            <MetaChip k="Markets" v={`${data.markets.length}`} />
            <MetaChip k="Coding agents" v={`${(lb.traction ?? []).length}`} />
            <MetaChip k="Snapshot" v={data.meta.scrapedAt.slice(0, 10)} />
          </div>
        </section>

        {/* Coding agents — scraped live via the leaderboard pipeline */}
        <TractionTable traction={lb.traction ?? []} benchmarks={lb.benchmarks} />

        {/* The whole market, from the committed full-site snapshot */}
        <section className="mx-auto max-w-6xl px-5 py-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Beyond coding — every market</h2>
            <span className="shrink-0 font-mono text-xs text-faint">
              top 30 of {all.length} agents · {data.markets.length} markets
            </span>
          </div>
          <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-faint">
            The highest-scoring agents across the whole database — support, sales, healthcare, legal
            and beyond. Coding agents hold their own at the very top.
          </p>

          <div className="overflow-x-auto">
            <div style={{ minWidth: 820 }}>
              <div
                className="grid items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint"
                style={{ gridTemplateColumns: grid }}
              >
                <span>#</span>
                <span>Agent</span>
                <span>Market</span>
                {PARTS.map((p) => (
                  <span key={p} className="text-right">
                    {p}
                  </span>
                ))}
                <span className="text-right">Score</span>
              </div>
              <div className="divide-y divide-edge/50">
                {top.map((a, i) => (
                  <div
                    key={a.slug}
                    className="rise grid items-center gap-x-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface/70"
                    style={{ gridTemplateColumns: grid, animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  >
                    <Rank rank={a.rank!} />
                    <div className="flex min-w-0 items-baseline gap-2">
                      <a
                        href={`https://theagentbenchmark.com/agents/${a.slug}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-display text-[15px] font-medium text-ink underline-offset-2 hover:text-accent"
                      >
                        {a.name ?? a.slug}
                      </a>
                      <span className="shrink-0 rounded border border-edge px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-faint">
                        {a.maker === "yc" ? `YC ${a.batch ?? ""}`.trim() : a.maker === "big_company" ? (a.batch ?? "big co") : "startup"}
                      </span>
                    </div>
                    <span className="truncate font-mono text-[12px] text-dim">{a.market ?? "—"}</span>
                    {PARTS.map((p) => (
                      <span key={p} className="tnum text-right font-mono text-[13px] text-dim">
                        {a.parts?.[p]?.score ?? "—"}
                      </span>
                    ))}
                    <span className="tnum text-right font-display text-base font-semibold text-ink">
                      {a.score!.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-4 font-mono text-[11px] leading-relaxed text-faint">
            Full database (evidence quotes, sources, news per agent) is committed at{" "}
            <span className="text-dim">web/src/data/agent-benchmark.json</span> — scraped from all
            1,017 pages of theagentbenchmark.com. Scores and methodology are theirs; rows link to
            their agent pages.
          </p>
        </section>
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}
