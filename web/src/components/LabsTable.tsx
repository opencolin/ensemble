"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LabEntry } from "@/lib/types";
import { slugFor } from "@/lib/select";
import { Rank, StatBar, OpenWeightBadge, TIER_CLASS } from "@/components/bits";
import { OpenFilter, type Weights } from "@/components/OpenFilter";

type SortKey = "score" | "models";

// Constant grid — never hide cells at breakpoints; the whole table scrolls
// horizontally inside the min-w wrapper instead (matches Leaderboard.tsx).
const GRID = "grid-cols-[2.5rem_minmax(11rem,1fr)_minmax(9rem,1.2fr)_4.5rem_9rem]";

export function LabsTable({ labs, labsOpen }: { labs: LabEntry[]; labsOpen: LabEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [weights, setWeights] = useState<Weights>("all");

  const active = weights === "open" ? labsOpen : labs;
  const sorted = useMemo(() => {
    const val = (l: LabEntry): number => (sortKey === "models" ? l.modelCount : l.score);
    // Sort in-direction (not asc-then-reverse) so tied rows keep their rank order.
    return [...active].sort((a, b) => (sortDir === "desc" ? val(b) - val(a) : val(a) - val(b)));
  }, [active, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "");

  return (
    <section id="labs" className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Team leaderboard</h2>
          <button
            onClick={() => { setSortKey("score"); setSortDir("desc"); setWeights("all"); }}
            className="font-mono text-xs text-faint underline-offset-2 hover:text-dim hover:underline"
          >
            reset
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-faint">
            {sorted.length} teams{weights === "open" ? " · open-weight" : ""}
          </span>
          <OpenFilter value={weights} onChange={setWeights} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {/* header */}
          <div className={`grid ${GRID} items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint`}>
            <span>#</span>
            <span>Team</span>
            <span>Best model</span>
            <button
              title="Models from this lab in the dataset"
              onClick={() => onSort("models")}
              className="text-right hover:text-dim"
            >
              Models {arrow("models")}
            </button>
            <button
              title="Composite of the lab's single best model (0–100)"
              onClick={() => onSort("score")}
              className="text-right hover:text-dim"
            >
              Score {arrow("score")}
            </button>
          </div>

          {/* rows */}
          <div className="divide-y divide-edge/50">
            {sorted.map((l, i) => (
              <div
                key={l.vendor}
                className={`rise grid ${GRID} items-center gap-x-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface/70`}
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              >
                <Rank rank={l.rank} />

                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/team/${slugFor(l.vendor)}`} className="truncate font-display text-[15px] font-medium text-ink transition-colors hover:text-accent">
                      {l.vendor}
                    </Link>
                    <span className={`size-1.5 shrink-0 rounded-full ${TIER_CLASS[l.tier].bar}`} />
                  </div>
                  {l.openWeight && (
                    <div className="flex items-center gap-2 font-mono text-[11px] text-faint">
                      <OpenWeightBadge />
                    </div>
                  )}
                </div>

                <Link
                  href={`/models/${slugFor(l.bestModelId)}`}
                  className="group flex min-w-0 items-center gap-1 font-mono text-[13px] text-dim transition-colors hover:text-accent"
                  title={l.bestModelName}
                >
                  <span className="truncate">{l.bestModelName}</span>
                  <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">→</span>
                </Link>

                <span className="tnum text-right font-mono text-[13px] text-dim">{l.modelCount}</span>

                <div className="flex items-center gap-2.5">
                  <div className="hidden flex-1 sm:block">
                    <StatBar value={l.score / 100} tone={l.tier} />
                  </div>
                  <span className="tnum w-12 shrink-0 text-right font-display text-base font-semibold text-ink">
                    {l.score.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
