import type { Metadata } from "next";
import { getLeaderboard } from "@/lib/leaderboard";
import { fetchDeepResearch, DEEP_RESEARCH_SITE } from "@/lib/deepResearch";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Rank } from "@/components/bits";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Deep Research — ixio",
  description:
    "Which agent researches best? Deep-research agents ranked on real multi-step web investigations — comprehensiveness, insight, instruction-following, readability, and citation accuracy (DeepResearch-Bench).",
};

function MetaChip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className="font-mono text-[13px] text-dim">{v}</span>
    </div>
  );
}

const n1 = (v: number | null) => (v == null ? "—" : v.toFixed(1));

export default async function DeepResearchPage() {
  const [lb, bench] = await Promise.all([getLeaderboard(), fetchDeepResearch()]);
  const GRID = "grid-cols-[2.5rem_minmax(11rem,1fr)_4.4rem_4.4rem_4.4rem_4.6rem_4.6rem_5rem]";
  const cited = bench?.rows.filter((r) => r.citationAccuracy != null).length ?? 0;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            DEEP RESEARCH · investigating the web
          </div>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Which agent researches your topic <span className="text-accent">best?</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            A deep-research agent doesn&apos;t write code — it plans a multi-step web investigation
            and returns a cited report. This ranks {bench?.rows.length ?? "—"} of them on{" "}
            <span className="text-ink">real research tasks</span>, scored for comprehensiveness,
            insight, instruction-following, readability, and — where measured — citation accuracy.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-4">
            <MetaChip k="Agents" v={`${bench?.rows.length ?? "—"}`} />
            <MetaChip k="Scored dimensions" v="4 quality + 2 citation" />
            <MetaChip k="Citation-audited" v={`${cited} of ${bench?.rows.length ?? "—"}`} />
            <MetaChip k="Updated" v={bench?.updated ?? "—"} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Research agents
              <span className="ml-2 font-mono text-sm font-normal text-faint">· ranked by overall score</span>
            </h2>
            <a href={DEEP_RESEARCH_SITE} target="_blank" rel="noreferrer" className="font-mono text-xs text-faint hover:text-accent">
              source: DeepResearch-Bench ↗
            </a>
          </div>

          {!bench ? (
            <p className="rounded-xl border border-edge bg-surface/40 px-5 py-10 text-center font-mono text-[13px] text-faint">
              Live data unavailable right now — the daily refresh will retry.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[780px]">
                <div className={`grid ${GRID} items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint`}>
                  <span>#</span>
                  <span>Agent</span>
                  <span className="text-right" title="Breadth of coverage">Compreh.</span>
                  <span className="text-right" title="Depth / originality of analysis">Insight</span>
                  <span className="text-right" title="Adherence to the brief">Instr.</span>
                  <span className="text-right" title="Structure & clarity of the report">Readab.</span>
                  <span className="text-right" title="Share of citations that check out (where audited)">Citation</span>
                  <span className="text-right" title="Composite across dimensions (0–100)">Overall</span>
                </div>
                <div className="divide-y divide-edge/50">
                  {bench.rows.map((r, i) => (
                    <div key={r.name} className={`rise grid ${GRID} items-center gap-x-3 rounded-lg px-3 py-3 ${i === 0 ? "bg-accent/[0.04]" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                      <Rank rank={i + 1} />
                      <span className="truncate font-display text-[15px] font-medium text-ink" title={r.name}>{r.name}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{n1(r.comprehensiveness)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{n1(r.insight)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{n1(r.instructionFollowing)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-dim">{n1(r.readability)}</span>
                      <span className="tnum text-right font-mono text-[13px] text-faint">{n1(r.citationAccuracy)}</span>
                      <span className="tnum text-right font-display text-base font-semibold text-ink">{r.overall.toFixed(2)}</span>
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
                Each agent runs the same set of real research prompts; an LLM-judge rubric scores the
                reports on comprehensiveness, insight, instruction-following, and readability, and the
                overall is their composite. Citation accuracy — the share of a report&apos;s citations
                that actually support their claims — is audited for a subset ({cited} agents here).
              </p>
            </div>
            <div className="rounded-xl border border-edge bg-surface/40 p-5">
              <div className="font-display text-base font-semibold text-ink">A different axis</div>
              <p className="mt-2 text-[13px] leading-relaxed text-faint">
                These are research agents, not coding agents — ranked here for completeness of the
                agent landscape, sourced from{" "}
                <a href={DEEP_RESEARCH_SITE} target="_blank" rel="noreferrer" className="text-dim underline-offset-2 hover:text-accent hover:underline">DeepResearch-Bench</a>{" "}
                and read straight from its open leaderboard, refreshed daily.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}
