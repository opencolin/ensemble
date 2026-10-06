import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard";
import { getHarness } from "@/lib/select";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "ixio — the coding-agent stack, ranked",
  description:
    "Agent = Model + Harness. ixio aggregates public benchmarks daily and ranks every layer of the stack: Top Model, Top Harness, Top Agent, Top Lab.",
};

function MetaChip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className="font-mono text-[13px] text-dim">{v}</span>
    </div>
  );
}

interface Row {
  name: string;
  sub?: string;
  stat: string;
}

/** One ranking page, previewed: the question it answers + its live top 3. */
function RankCard({ n, href, label, axis, question, rows }: { n: string; href: string; label: string; axis: string; question: string; rows: Row[] }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-edge bg-surface/50 p-6 transition-colors hover:border-accent-dim/60 hover:bg-surface/80"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wider text-accent">
          {n} · {label.toUpperCase()}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{axis}</span>
      </div>
      <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-ink">{question}</h2>

      <div className="mt-5 flex flex-col divide-y divide-edge/50 border-t border-edge/70">
        {rows.map((r, i) => (
          <div key={r.name} className="flex items-center gap-3 py-2.5">
            <span className={`tnum w-6 shrink-0 font-mono text-[13px] ${i === 0 ? "text-accent" : "text-faint"}`}>
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="truncate font-display text-[15px] font-medium text-ink">{r.name}</span>
              {r.sub && <span className="truncate font-mono text-[11px] text-faint">{r.sub}</span>}
            </div>
            <span className="tnum shrink-0 font-mono text-[13px] text-dim">{r.stat}</span>
          </div>
        ))}
      </div>

      <span className="mt-5 font-mono text-[12px] text-dim transition-colors group-hover:text-accent">
        Full ranking →
      </span>
    </Link>
  );
}

export default async function Home() {
  const lb = await getLeaderboard();
  const meta = lb.meta;

  const models: Row[] = lb.models.slice(0, 3).map((m) => ({ name: m.modelName, sub: m.vendor, stat: m.composite.toFixed(0) }));
  const harnesses: Row[] = lb.agents.slice(0, 3).map((a) => ({
    name: getHarness(lb, a.harnessId)?.name ?? a.harnessId,
    sub: `best: ${a.bestModelName}`,
    stat: a.score.toFixed(0),
  }));
  const agents: Row[] = (lb.traction ?? []).slice(0, 3).map((t) => ({
    name: t.name,
    sub: t.vendor !== "Unknown" && t.vendor !== t.name ? t.vendor : undefined,
    stat: (t.score / 10).toFixed(1),
  }));
  const labs: Row[] = lb.labs.slice(0, 3).map((l) => ({ name: l.vendor, sub: l.bestModelName, stat: l.score.toFixed(0) }));

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* hero */}
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-10">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            AGENT = MODEL + HARNESS · live leaderboard
          </div>

          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.6rem]">
            The coding-agent stack, <span className="text-accent">ranked</span>.
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            A coding agent is a <span className="text-ink">model</span> (the compute) driven through
            a <span className="text-ink">harness</span> (the interface), shipped as a{" "}
            <span className="text-ink">product</span> by a <span className="text-ink">lab</span>.
            ixio scrapes public benchmarks daily, normalizes the mess, and ranks every layer of that
            stack — one dataset, four leaderboards.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-5">
            <MetaChip k="Results" v={`${meta.totalEntries}`} />
            <MetaChip k="Models" v={`${meta.modelCount}`} />
            <MetaChip k="Harnesses" v={`${meta.harnessCount}`} />
            <MetaChip k="Benchmarks" v={`${meta.benchmarkCount}`} />
            <MetaChip k="Updated" v={meta.scrapedAt.slice(0, 10)} />
          </div>
        </section>

        {/* the four rankings */}
        <section className="mx-auto max-w-6xl px-5 pb-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RankCard n="01" href="/leaderboard" label="Top Model" axis="the compute" question="Which model is the best coding brain?" rows={models} />
            <RankCard n="02" href="/agents" label="Top Harness" axis="the interface" question="Which CLI or IDE gets the most out of a model?" rows={harnesses} />
            <RankCard n="03" href="/top-agents" label="Top Agent" axis="the product" question="Which shipping agents are real in the market?" rows={agents} />
            <RankCard n="04" href="/team" label="Top Lab" axis="the maker" question="Which lab makes the best coding model?" rows={labs} />
          </div>
        </section>

        {/* secondary */}
        <section className="mx-auto max-w-6xl px-5 pb-14">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-edge bg-surface/40 px-5 py-3 text-[13px] text-faint">
            Under the hood:{" "}
            <Link href="/benchmarks" className="text-dim underline-offset-2 hover:text-accent hover:underline">
              we rank the benchmarks themselves
            </Link>
            {" · "}
            <Link href="/gaps" className="text-dim underline-offset-2 hover:text-accent hover:underline">
              the harness × model pairs nobody measures
            </Link>
            {" · "}
            <Link href="/leaderboard#method" className="text-dim underline-offset-2 hover:text-accent hover:underline">
              methodology
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter meta={meta} />
    </>
  );
}
