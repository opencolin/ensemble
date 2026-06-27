"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AgentEntry, Harness } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { StatBar, Rank, TIER_CLASS } from "@/components/bits";
import { OpenFilter, type Weights } from "@/components/OpenFilter";

/** An agent row already joined with its harness (done server-side). */
export type AgentRow = AgentEntry & { harness: Harness };

type SortKey = "score" | "bestScore" | "medianScore" | "modelsTested";

const COL_DEF: { key: SortKey; label: string; hint: string }[] = [
  { key: "score", label: "Score", hint: "Best composite the harness reaches (0–100)" },
  { key: "bestScore", label: "Best", hint: "Score of the top model on this harness" },
  { key: "medianScore", label: "Median", hint: "Median score across the models tested" },
  { key: "modelsTested", label: "Models", hint: "How many models we ran on this harness" },
];

export function AgentsTable({ all, open }: { all: AgentRow[]; open: AgentRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [weights, setWeights] = useState<Weights>("all");

  const rows = weights === "open" ? open : all;
  const sorted = useMemo(() => {
    // Sort in-direction (not asc-then-reverse) so tied rows keep their rank order.
    return [...rows].sort((a, b) => (dir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
  }, [rows, sortKey, dir]);

  const sort = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  };
  const reset = () => {
    setSortKey("score");
    setDir("desc");
    setWeights("all");
  };
  const arrow = (key: SortKey) => (sortKey === key ? (dir === "desc" ? "↓" : "↑") : "");

  // Constant grid — never hide cells at breakpoints; the whole table scrolls
  // horizontally inside the minWidth wrapper instead (matches Leaderboard.tsx).
  // Rank | Agent | Best model | Median | Models | Benchmarks | Score (+board link)
  const grid =
    "2.5rem minmax(12rem,1fr) minmax(9rem,1.1fr) 4.6rem 4.4rem minmax(7rem,1fr) 10rem";
  const minW = 880;

  return (
    <section id="agents" className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Harness leaderboard</h2>
          <button
            onClick={reset}
            className="font-mono text-xs text-faint underline-offset-2 hover:text-dim hover:underline"
          >
            reset
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-faint">
            {rows.length} harnesses{weights === "open" ? " · open-weight" : ""}
          </span>
          <OpenFilter value={weights} onChange={setWeights} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: minW }}>
          {/* header */}
          <div
            className="grid items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint"
            style={{ gridTemplateColumns: grid }}
          >
            <span>#</span>
            <span>Agent</span>
            <button onClick={() => sort("bestScore")} title={COL_DEF[1].hint} className="text-left hover:text-dim">
              Best model {arrow("bestScore")}
            </button>
            <button onClick={() => sort("medianScore")} title={COL_DEF[2].hint} className="text-right hover:text-dim">
              Median {arrow("medianScore")}
            </button>
            <button onClick={() => sort("modelsTested")} title={COL_DEF[3].hint} className="text-right hover:text-dim">
              Models {arrow("modelsTested")}
            </button>
            <span>Benchmarks</span>
            <button onClick={() => sort("score")} title={COL_DEF[0].hint} className="text-right hover:text-dim">
              Score {arrow("score")}
            </button>
          </div>

          {/* rows */}
          <div className="divide-y divide-edge/50">
            {sorted.map((a, i) => {
              const h = a.harness;
              return (
                <div
                  key={a.harnessId}
                  className="rise grid items-center gap-x-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface/70"
                  style={{ gridTemplateColumns: grid, animationDelay: `${Math.min(i, 12) * 30}ms` }}
                >
                  <Rank rank={a.rank} />

                  {/* Agent: harness name + vendor · kind chip line */}
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-[15px] font-medium text-ink">
                        {h.name}
                      </span>
                      <span className={`size-1.5 shrink-0 rounded-full ${TIER_CLASS[a.tier].bar}`} />
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-faint">
                      <span className="truncate">{h.vendor}</span>
                      <span className="text-edge2">·</span>
                      <span className="rounded border border-edge px-1.5 py-px uppercase tracking-wider">
                        {KIND_LABEL[h.kind]}
                      </span>
                    </div>
                  </div>

                  {/* Best model + its score */}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-mono text-[12px] text-dim" title={a.bestModelName}>
                      {a.bestModelName}
                    </span>
                    <span className="tnum font-mono text-[11px] text-faint">{a.bestScore.toFixed(1)}</span>
                  </div>

                  {/* Median */}
                  <span className="tnum text-right font-mono text-[13px] text-dim">
                    {a.medianScore.toFixed(1)}
                  </span>

                  {/* Models tested */}
                  <span className="tnum text-right font-mono text-[13px] text-dim">{a.modelsTested}</span>

                  {/* Benchmarks — small chips of the benchmark ids */}
                  <div className="flex flex-wrap gap-1">
                    {a.benchmarks.length ? (
                      a.benchmarks.map((b) => (
                        <span
                          key={b}
                          className="rounded border border-edge px-1.5 py-px font-mono text-[10px] text-faint"
                        >
                          {b}
                        </span>
                      ))
                    ) : (
                      <span className="font-mono text-[11px] text-faint">—</span>
                    )}
                  </div>

                  {/* Score bar + number, then a board link in this same cell.
                      Featured harnesses link to their model board; others show a muted —.
                      The board link lives in its own cell (the row is NOT a link), so
                      we never nest a clickable inside a clickable. */}
                  <div className="flex items-center justify-end gap-2.5">
                    <div className="hidden flex-1 sm:block">
                      <StatBar value={a.score / 100} tone={a.tier} />
                    </div>
                    <span className="tnum w-9 shrink-0 text-right font-display text-base font-semibold text-ink">
                      {a.score.toFixed(0)}
                    </span>
                    <Link
                      href={`/agents/${a.harnessId}`}
                      className="shrink-0 whitespace-nowrap rounded-md border border-edge px-2 py-1 font-mono text-[11px] text-dim transition-colors hover:border-edge2 hover:text-ink"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-5 font-mono text-[11px] leading-relaxed text-faint">
        A single-model agent is still a real leaderboard entry — the{" "}
        <span className="text-dim">Models</span> column surfaces how many models we ran on each
        harness, so you can see coverage at a glance. Score is the best composite a harness reaches,
        so a harness is only as good as the models it can drive.
      </p>
    </section>
  );
}
