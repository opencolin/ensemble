"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { HarnessBoard, Harness, ModelEntry, Benchmark } from "@/lib/types";
import { slugFor } from "@/lib/select";
import { Rank, StatBar, OpenWeightBadge, TIER_CLASS } from "@/components/bits";
import { OpenFilter, type Weights } from "@/components/OpenFilter";

export function Leaderboard({ board, harness, benchmarks }: { board: HarnessBoard; harness: Harness; benchmarks: Benchmark[] }) {
  const benches = board.benchmarks.map((id) => benchmarks.find((b) => b.id === id)!).filter(Boolean);
  const [sortKey, setSortKey] = useState<string>("score"); // "score" | benchmarkId
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [weights, setWeights] = useState<Weights>("all");

  const models = weights === "open" ? board.models.filter((m) => m.openWeight) : board.models;
  // Display rank = standing by composite within the active (filtered) set.
  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    [...models].sort((a, b) => b.composite - a.composite).forEach((x, i) => map.set(x.modelId, i + 1));
    return map;
  }, [models]);
  const rows = useMemo(() => {
    const val = (m: ModelEntry) => (sortKey === "score" ? m.composite : (m.scores[sortKey]?.raw ?? -1));
    // Sort in-direction (not asc-then-reverse) so tied rows keep their rank order.
    return [...models].sort((a, b) => (dir === "desc" ? val(b) - val(a) : val(a) - val(b)));
  }, [models, sortKey, dir]);

  const sort = (key: string) => {
    if (key === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setDir("desc"); }
  };
  const arrow = (key: string) => (sortKey === key ? (dir === "desc" ? "↓" : "↑") : "");

  const grid = `2.5rem minmax(10rem,1fr) ${benches.map(() => "4.5rem").join(" ")} 8.5rem`;
  const minW = 360 + benches.length * 72 + 180;

  return (
    <section id="leaderboard" className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Best models
          <span className="ml-2 font-mono text-sm font-normal text-faint">· {harness.name}</span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-faint">
            {models.length} models · {benches.map((b) => b.name).join(" + ")}
          </span>
          <OpenFilter value={weights} onChange={setWeights} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: minW }}>
          {/* header */}
          <div className="grid items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint" style={{ gridTemplateColumns: grid }}>
            <span>#</span>
            <span>Model</span>
            {benches.map((b) => (
              <button key={b.id} onClick={() => sort(b.id)} title={`${b.name} · ${b.metric}`} className="text-right hover:text-dim">
                {shortBench(b.name)} {arrow(b.id)}
              </button>
            ))}
            <button onClick={() => sort("score")} title="Percentile-blended across benchmarks (0–100)" className="text-right hover:text-dim">
              Score {arrow("score")}
            </button>
          </div>

          {/* rows */}
          <div className="divide-y divide-edge/50">
            {rows.map((m, i) => (
              <Link
                key={m.modelId}
                href={`/models/${slugFor(m.modelId)}`}
                className="rise grid items-center gap-x-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface/70"
                style={{ gridTemplateColumns: grid, animationDelay: `${Math.min(i, 12) * 30}ms` }}
              >
                <Rank rank={rankMap.get(m.modelId) ?? m.rank} />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-[15px] font-medium text-ink">{m.modelName}</span>
                    <span className={`size-1.5 shrink-0 rounded-full ${TIER_CLASS[m.tier].bar}`} />
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-faint">
                    <span className="truncate">{m.vendor}</span>
                    {m.openWeight && <OpenWeightBadge />}
                  </div>
                </div>
                {benches.map((b) => {
                  const c = m.scores[b.id];
                  return (
                    <span key={b.id} className="tnum text-right font-mono text-[13px] text-dim">
                      {c ? (
                        <>
                          {c.raw}%{c.anchor && <sup className="ml-0.5 text-[9px] uppercase tracking-wide text-faint">ref</sup>}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  );
                })}
                <div className="flex items-center gap-2.5">
                  <div className="hidden flex-1 sm:block">
                    <StatBar value={m.composite / 100} tone={m.tier} />
                  </div>
                  <span className="tnum w-12 shrink-0 text-right font-display text-base font-semibold text-ink">
                    {m.composite.toFixed(0)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {rows.length === 0 && (
            <p className="px-3 py-10 text-center font-mono text-[13px] text-faint">
              No open-weight models tested with {harness.name}.
            </p>
          )}
        </div>
      </div>

      {models.some((m) => Object.values(m.scores).some((c) => c.anchor)) && (
        <p className="mt-4 max-w-3xl font-mono text-[11px] leading-relaxed text-faint">
          <span className="text-dim">ref</span> = reference anchor. Anthropic&apos;s own flagships are{" "}
          {harness.name}&apos;s native models and set the ceiling here; they aren&apos;t re-run through
          our open-model harness. Every score without a <span className="text-dim">ref</span> tag is
          measured by us.
        </p>
      )}
    </section>
  );
}

function shortBench(name: string) {
  return name.replace(/ Verified| 2\.0/g, "");
}
