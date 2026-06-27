import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KIND_LABEL } from "@/lib/types";
import { getLeaderboard } from "@/lib/leaderboard";
import { getHarness, boardByHarness, getAgent } from "@/lib/select";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Leaderboard } from "@/components/Leaderboard";
import { TierChip, OpenWeightBadge, TIER_CLASS } from "@/components/bits";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  const lb = await getLeaderboard();
  return lb.boards.map((b) => ({ id: b.harnessId }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const lb = await getLeaderboard();
  const h = getHarness(lb, id);
  if (!h) return { title: "Agent not found — ixio" };
  return { title: `${h.name} — ixio`, description: `Every model tested with ${h.name}, ranked by benchmark score.` };
}

function Stat({ k, v, cls = "text-ink" }: { k: string; v: string; cls?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className={`tnum font-display text-4xl font-semibold ${cls}`}>{v}</span>
    </div>
  );
}

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lb = await getLeaderboard();
  const harness = getHarness(lb, id);
  const board = boardByHarness(lb, id);
  if (!harness || !board) notFound();
  const agent = getAgent(lb, id);
  const benches = board.benchmarks.map((b) => lb.benchmarks.find((x) => x.id === b)?.name).filter(Boolean);
  const best = board.models[0];

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-10">
          <Link href="/agents" className="font-mono text-xs text-faint hover:text-dim">
            ← Top Agent
          </Link>

          <div className="mt-5 flex flex-col gap-6 border-b border-edge/70 pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {agent && <TierChip tier={agent.tier} />}
                <span className="rounded border border-edge px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-faint">
                  {KIND_LABEL[harness.kind]}
                </span>
                {harness.featured && (
                  <span className="rounded border border-accent-dim/40 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-accent/80">
                    in switcher
                  </span>
                )}
                {harness.homepage && (
                  <a href={harness.homepage} target="_blank" rel="noreferrer" className="rounded border border-edge px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-dim transition-colors hover:border-edge2 hover:text-accent">
                    repo ↗
                  </a>
                )}
              </div>
              <h1 className="font-display text-4xl font-semibold tracking-tight">{harness.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[13px] text-faint">
                <span className="text-dim">{harness.vendor}</span>
                <span className="text-edge2">·</span>
                <span>{board.models.length} models tested</span>
                <span className="text-edge2">·</span>
                <span>{benches.join(" + ")}</span>
              </div>
            </div>

            <div className="flex items-end gap-8">
              {agent && <Stat k="Agent rank" v={`#${agent.rank}`} cls={TIER_CLASS[agent.tier].text} />}
              {agent && <Stat k="Score" v={agent.score.toFixed(1)} />}
            </div>
          </div>

          {best && (
            <p className="mt-4 text-[13px] text-dim">
              Best on {harness.name}:{" "}
              <span className="font-medium text-ink">{best.modelName}</span>
              {best.openWeight && <span className="ml-1.5 align-middle"><OpenWeightBadge /></span>}{" "}
              <span className="font-mono text-faint">· {best.composite.toFixed(0)}</span>
            </p>
          )}
        </section>

        <Leaderboard board={board} harness={harness} benchmarks={lb.benchmarks} />
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}
