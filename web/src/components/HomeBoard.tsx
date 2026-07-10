"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Leaderboard, Harness } from "@/lib/types";
import { featuredHarnesses, boardByHarness, getHarness, slugFor } from "@/lib/select";
import { HarnessSwitcher } from "@/components/HarnessSwitcher";
import { Leaderboard as Board } from "@/components/Leaderboard";

function MetaChip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className="font-mono text-[13px] text-dim">{v}</span>
    </div>
  );
}

function HighlightCard({ href, eyebrow, title, sub, stat }: { href: string; eyebrow: string; title: string; sub: string; stat: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-2 rounded-xl border border-edge bg-surface/50 p-4 transition-all hover:-translate-y-0.5 hover:border-edge2 hover:bg-surface">
      <span className="text-[10px] uppercase tracking-wider text-faint">{eyebrow}</span>
      <div className="font-display text-lg font-semibold tracking-tight text-ink">{title}</div>
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="font-mono text-xs text-faint">{sub}</span>
        <span className="font-mono text-sm font-medium text-accent">{stat}</span>
      </div>
    </Link>
  );
}

export function HomeBoard({ lb }: { lb: Leaderboard }) {
  const featured = featuredHarnesses(lb);
  const [hid, setHid] = useState(lb.meta.defaultHarnessId);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("harness");
    if (p && featured.some((h) => h.id === p)) setHid(p);
  }, [featured]);

  const select = (id: string) => {
    setHid(id);
    const u = new URL(window.location.href);
    if (id === lb.meta.defaultHarnessId) u.searchParams.delete("harness");
    else u.searchParams.set("harness", id);
    window.history.replaceState(null, "", u);
  };

  const board = boardByHarness(lb, hid); // undefined for a known-but-unbenchmarked harness
  const harness = getHarness(lb, hid)!;
  const topModel = lb.models[0];
  const topLab = lb.labs[0];
  const topAgent = lb.agents[0];
  const topAgentH = getHarness(lb, topAgent.harnessId);
  const bestOpen = lb.models.find((m) => m.openWeight);

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-9">
        <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
          {lb.meta.status === "snapshot" ? "CODING-AGENT LEADERBOARD · cached" : "CODING-AGENT LEADERBOARD · live"}
        </div>

        <h1 className="mt-4 max-w-4xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
          Which model is the best for{" "}
          <HarnessSwitcher value={hid} options={featured} onChange={select} />?
        </h1>
        <p className="mt-3 font-mono text-xs text-faint">↑ choose your agent harness</p>

        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
          A coding agent is a <span className="text-ink">model</span> wrapped in a{" "}
          <span className="text-ink">harness</span>. Pick your harness above; these are the
          best models to run with{" "}
          <span className="text-ink">{harness.name}</span>, pulled from public benchmark
          leaderboards.
        </p>

        {/* Agent = Model + Harness */}
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-edge bg-surface/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 font-display text-lg">
              <span className="text-ink">Agent</span>
              <span className="text-faint">=</span>
              <span className="rounded-md bg-accent/10 px-2 py-0.5 text-accent ring-1 ring-inset ring-accent/25">Model</span>
              <span className="text-faint">+</span>
              <span className="rounded-md bg-edge/60 px-2 py-0.5 text-ink">{harness.name}</span>
            </div>
            <span className="font-mono text-[11px] text-faint">
              the <span className="text-dim">compute</span>{" "}× the{" "}<span className="text-dim">interface</span>{" "}— that&apos;s <span className="text-dim">ixio</span>
            </span>
          </div>
          <p className="text-[13px] text-faint">
            Three rankings off one dataset:{" "}
            <Link href="/" className="text-dim underline-offset-2 hover:text-accent hover:underline">Top Model</Link>,{" "}
            <Link href="/agents" className="text-dim underline-offset-2 hover:text-accent hover:underline">Top Agent</Link>,{" "}
            <Link href="/team" className="text-dim underline-offset-2 hover:text-accent hover:underline">Top Team</Link>.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-5">
          <MetaChip k="Harness" v={harness.name} />
          <MetaChip k="Models ranked" v={board ? `${board.models.length}` : "—"} />
          <MetaChip k="Benchmarks" v={`${lb.meta.benchmarkCount}`} />
          <MetaChip k="Total results" v={`${lb.meta.totalEntries}`} />
          <MetaChip k="Updated" v={lb.meta.scrapedAt.slice(0, 10)} />
        </div>
      </section>

      {/* cross-ranking highlights */}
      <section className="mx-auto max-w-6xl px-5 py-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {topModel && <HighlightCard href={`/models/${slugFor(topModel.modelId)}`} eyebrow="Top model" title={topModel.modelName} sub={`${Object.keys(topModel.scores).length} benchmarks`} stat={`${topModel.composite.toFixed(0)}`} />}
          {topLab && <HighlightCard href={`/team/${slugFor(topLab.vendor)}`} eyebrow="Top team" title={topLab.vendor} sub={topLab.bestModelName} stat={`#1`} />}
          {topAgentH && <HighlightCard href={`/agents/${topAgent.harnessId}`} eyebrow="Top agent" title={topAgentH.name} sub={topAgent.bestModelName} stat={`${topAgent.score.toFixed(0)}`} />}
          {bestOpen && <HighlightCard href={`/models/${slugFor(bestOpen.modelId)}`} eyebrow="Best open-weight" title={bestOpen.modelName} sub={bestOpen.vendor} stat={`#${bestOpen.rank}`} />}
          {board?.models[0] && <HighlightCard href={`/models/${slugFor(board.models[0].modelId)}`} eyebrow={`#1 on ${harness.name}`} title={board.models[0].modelName} sub={board.models[0].vendor} stat={`${board.models[0].composite.toFixed(0)}`} />}
        </div>
      </section>

      {/* overall model ranking — every benchmark, evidence-weighted */}
      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Top models
            <span className="ml-2 font-mono text-sm font-normal text-faint">· across every benchmark</span>
          </h2>
          <span className="shrink-0 font-mono text-xs text-faint">composite of {lb.meta.benchmarkCount} benchmarks · breadth-weighted</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-edge bg-surface/40">
          <div className="min-w-[560px] divide-y divide-edge/50">
            {lb.models.slice(0, 10).map((m) => (
              <Link key={m.modelId} href={`/models/${slugFor(m.modelId)}`} className="grid grid-cols-[2.5rem_minmax(10rem,1fr)_8rem_6.5rem_3.5rem] items-center gap-x-3 px-4 py-2.5 transition-colors hover:bg-surface/70">
                <span className={`font-display text-sm font-semibold ${m.rank <= 3 ? "text-accent" : "text-faint"}`}>#{m.rank}</span>
                <span className="truncate font-display text-[14px] font-medium text-ink">{m.modelName}</span>
                <span className="truncate font-mono text-[11px] text-faint">{m.vendor}</span>
                <span className="font-mono text-[11px] text-faint">{Object.keys(m.scores).length} benchmarks</span>
                <span className="tnum text-right font-display text-[15px] font-semibold text-ink">{m.composite.toFixed(0)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div key={hid}>
        {board ? (
          <Board board={board} harness={harness} benchmarks={lb.benchmarks} />
        ) : (
          <EmptyBoard harness={harness} />
        )}
      </div>
    </>
  );
}

/** Shown when a switcher harness is known but has no benchmarked models yet. */
function EmptyBoard({ harness }: { harness: Harness }) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="rounded-xl border border-edge bg-surface/40 px-6 py-14 text-center">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          {harness.name} isn&apos;t benchmarked yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-faint">
          It&apos;s a coding agent people use, but it hasn&apos;t shown up in a public benchmark we
          scrape — so there are no model results to rank for it here yet.
        </p>
        <Link
          href="/agents"
          className="mt-5 inline-block font-mono text-[13px] text-accent underline-offset-2 hover:underline"
        >
          See every agent on Top Agent →
        </Link>
      </div>
    </section>
  );
}
