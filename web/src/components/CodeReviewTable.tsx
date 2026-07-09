"use client";

import { useMemo, useState } from "react";
import type { Reviewer } from "@/lib/codeReview";
import { Rank, StatBar } from "@/components/bits";

type Key = "f1" | "recall" | "precision";

export function CodeReviewTable({ reviewers, totalBugs }: { reviewers: Reviewer[]; totalBugs: number }) {
  const [sortKey, setSortKey] = useState<Key>("f1");
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const rows = useMemo(
    () => [...reviewers].sort((a, b) => (dir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey])),
    [reviewers, sortKey, dir],
  );
  const max = useMemo(() => Math.max(...reviewers.map((r) => r[sortKey])), [reviewers, sortKey]);

  const sort = (k: Key) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setDir("desc"); }
  };
  const arrow = (k: Key) => (sortKey === k ? (dir === "desc" ? "↓" : "↑") : "");
  const grid = "2.5rem minmax(9rem,1fr) 6rem 6rem 9rem";

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 560 }}>
        <div className="grid items-center gap-x-3 border-b border-edge px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-faint" style={{ gridTemplateColumns: grid }}>
          <span>#</span>
          <span>Reviewer</span>
          <button onClick={() => sort("recall")} title="Share of real bugs caught" className="text-right hover:text-dim">Recall {arrow("recall")}</button>
          <button onClick={() => sort("precision")} title="Share of its comments that are real bugs" className="text-right hover:text-dim">Precision {arrow("precision")}</button>
          <button onClick={() => sort("f1")} title="Harmonic mean of recall & precision" className="text-right hover:text-dim">F1 {arrow("f1")}</button>
        </div>
        <div className="divide-y divide-edge/50">
          {rows.map((r, i) => (
            <div key={r.name} className="rise grid items-center gap-x-3 rounded-lg px-3 py-3" style={{ gridTemplateColumns: grid, animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <Rank rank={i + 1} />
              <div className="flex min-w-0 flex-col gap-1">
                <a href={r.homepage} target="_blank" rel="noreferrer" className="truncate font-display text-[15px] font-medium text-ink hover:text-accent">
                  {r.name}
                </a>
                <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                  {r.kind === "reviewer" ? "review tool" : "coding agent"}
                </span>
              </div>
              <span className={`tnum text-right font-mono text-[13px] ${sortKey === "recall" ? "text-ink" : "text-dim"}`}>
                {r.recall}%
                <span className="ml-1 hidden text-[10px] text-faint sm:inline">{r.caught}/{totalBugs}</span>
              </span>
              <span className={`tnum text-right font-mono text-[13px] ${sortKey === "precision" ? "text-ink" : "text-dim"}`}>{r.precision}%</span>
              <div className="flex items-center gap-2.5">
                <div className="hidden flex-1 sm:block"><StatBar value={r[sortKey] / max} tone={i === 0 ? "excellent" : "solid"} /></div>
                <span className="tnum w-10 shrink-0 text-right font-display text-base font-semibold text-ink">{r.f1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
