import type { Metadata } from "next";
import { getLeaderboard } from "@/lib/leaderboard";
import { KIND_LABEL } from "@/lib/types";
import { getHarness } from "@/lib/select";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AgentsTable } from "@/components/AgentsTable";
import Link from "next/link";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Top Agent — ixio",
  description:
    "Which coding-agent harness is best? ixio ranks the CLIs and TUIs that turn a model into an agent by the best results they get from the models we tested.",
};

function MetaChip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className="font-mono text-[13px] text-dim">{v}</span>
    </div>
  );
}

export default async function AgentsPage() {
  const lb = await getLeaderboard();
  const meta = lb.meta;

  // Join each agent with its harness up front so the client table never needs `lb`.
  const join = (arr: typeof lb.agents) => arr.map((a) => ({ ...a, harness: getHarness(lb, a.harnessId)! }));
  const rows = join(lb.agents);
  const rowsOpen = join(lb.agentsOpen);
  // Catalogued harnesses with no benchmark data (e.g. top OpenRouter agents).
  const known = lb.harnesses.filter((h) => !lb.agents.some((a) => a.harnessId === h.id));

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* hero — mirrors HomeBoard hero spacing/typography */}
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-9">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            CODING-AGENT LEADERBOARD · harnesses
          </div>

          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Which harness is the best{" "}
            <span className="text-accent">coding agent?</span>
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            An <span className="text-ink">agent = a model + a harness</span>. The harness is the
            scaffolding — the <span className="text-ink">CLI or TUI</span> — that wraps a raw model
            and turns it into something that edits files, runs tools, and finishes a task. The{" "}
            <Link href="/leaderboard" className="text-dim underline-offset-2 hover:text-accent hover:underline">
              Top Model
            </Link>{" "}
            board holds the harness fixed and ranks models; here we flip it and rank the{" "}
            <span className="text-ink">harnesses</span> themselves — each scored by the best results
            it gets across the models we ran on it.
          </p>

          {/* cross-ranking links */}
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-edge bg-surface/40 px-5 py-3 text-[13px] text-faint">
            Three rankings off one dataset:{" "}
            <Link href="/leaderboard" className="text-dim underline-offset-2 hover:text-accent hover:underline">
              Top Model
            </Link>
            {" · "}
            <span className="text-ink">Top Agent</span>
            {" · "}
            <Link href="/team" className="text-dim underline-offset-2 hover:text-accent hover:underline">
              Top Team
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-4">
            <MetaChip k="Ranked" v={`${lb.agents.length} harnesses`} />
            <MetaChip k="Kinds" v="CLI · TUI · IDE" />
            <MetaChip k="Benchmarks" v={`${meta.benchmarkCount}`} />
            <MetaChip k="Updated" v={meta.scrapedAt.slice(0, 10)} />
          </div>
        </section>

        <AgentsTable all={rows} open={rowsOpen} />

        {known.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 py-8">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">Known agents · not yet benchmarked</h2>
              <span className="shrink-0 font-mono text-xs text-faint">{known.length} · popular on OpenRouter</span>
            </div>
            <p className="mb-5 max-w-2xl text-[13px] text-faint">
              Widely-used coding agents that haven&apos;t submitted to a benchmark we scrape
              (SWE-bench, Terminal-Bench, CodingAgentBench), so they have no harness × model scores
              yet — they can&apos;t be ranked until they do.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {known.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-surface/40 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-[15px] font-medium text-ink">{h.name}</span>
                      <span className="shrink-0 rounded border border-edge px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-faint">{KIND_LABEL[h.kind]}</span>
                    </div>
                    <span className="font-mono text-[11px] text-faint">{h.vendor}</span>
                  </div>
                  {h.homepage && (
                    <a href={h.homepage} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-[11px] text-dim transition-colors hover:text-accent">
                      site ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter meta={meta} />
    </>
  );
}
