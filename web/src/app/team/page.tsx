import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LabsTable } from "@/components/LabsTable";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Top Team — ixio",
  description:
    "Which team makes the best coding model? ixio ranks each team by its single best model — a composite percentile-blended across public benchmarks.",
};

export default async function TeamPage() {
  const lb = await getLeaderboard();
  const meta = lb.meta;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-10">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            CODING-AGENT LEADERBOARD · teams
          </div>

          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Which team makes the best{" "}
            <span className="text-accent">coding model?</span>
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            Every team is only as good as its <span className="text-ink">single best model</span>.
            So each one here is ranked by that model&apos;s composite — a percentile-blended score
            across every public benchmark we scrape, fair across scales — not by how many models it
            ships. Flip to <span className="text-ink">Open</span> to rank by best open-weight model.
          </p>

          <p className="mt-5 max-w-2xl text-[13px] text-faint">
            One dataset, three rankings:{" "}
            <Link href="/" className="text-dim underline-offset-2 hover:text-accent hover:underline">Top Model</Link>,{" "}
            <Link href="/agents" className="text-dim underline-offset-2 hover:text-accent hover:underline">Top Agent</Link>,
            and Top Team.
          </p>

          <div className="mt-9 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-4">
            <MetaChip k="Teams ranked" v={`${lb.labs.length}`} />
            <MetaChip k="Models" v={`${meta.modelCount}`} />
            <MetaChip k="Benchmarks" v={`${meta.benchmarkCount}`} />
            <MetaChip k="Updated" v={meta.scrapedAt.slice(0, 10)} />
          </div>
        </section>

        <LabsTable labs={lb.labs} labsOpen={lb.labsOpen} />

        <section className="mx-auto max-w-6xl px-5 pb-12">
          <p className="font-mono text-[11px] leading-relaxed text-faint">
            A team&apos;s score is the composite of its top-ranked model — shipping more models never
            helps unless one is genuinely better. <span className="text-dim">Best model →</span>{" "}
            opens that model&apos;s full profile.
          </p>
        </section>
      </main>
      <SiteFooter meta={meta} />
    </>
  );
}

function MetaChip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className="font-mono text-[13px] text-dim">{v}</span>
    </div>
  );
}
