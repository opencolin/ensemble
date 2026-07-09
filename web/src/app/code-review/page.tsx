import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard";
import { CODE_REVIEW } from "@/lib/codeReview";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CodeReviewTable } from "@/components/CodeReviewTable";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Code Review — ixio",
  description:
    "Which AI agent reviews code best? Code-review tools ranked by the real production bugs they catch — by F1, not just recall.",
};

function MetaChip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className="font-mono text-[13px] text-dim">{v}</span>
    </div>
  );
}

export default async function CodeReviewPage() {
  const lb = await getLeaderboard();
  const cr = CODE_REVIEW;
  const topF1 = [...cr.reviewers].sort((a, b) => b.f1 - a.f1)[0];
  const topRecall = [...cr.reviewers].sort((a, b) => b.recall - a.recall)[0];
  const topPrec = [...cr.reviewers].sort((a, b) => b.precision - a.precision)[0];

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            CODE REVIEW · catching real bugs
          </div>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Which agent reviews your code{" "}
            <span className="text-accent">best?</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            A code-review agent doesn&apos;t write code — it reads a pull request and flags the bugs
            before they ship. This ranks {cr.reviewers.length} of them on{" "}
            <span className="text-ink">{cr.totalBugs} real, merged bug-fixes</span> replayed across{" "}
            {cr.prs} PRs from {cr.repos} production codebases, graded by a {cr.judges}-judge LLM panel.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-5">
            <MetaChip k="Reviewers" v={`${cr.reviewers.length}`} />
            <MetaChip k="Real bugs" v={`${cr.totalBugs}`} />
            <MetaChip k="PRs · repos" v={`${cr.prs} · ${cr.repos}`} />
            <MetaChip k="LLM judges" v={`${cr.judges}`} />
            <MetaChip k="Updated" v={cr.updated} />
          </div>
        </section>

        {/* the honest caveat — front and center */}
        <section className="mx-auto max-w-6xl px-5 py-2">
          <div className="rounded-xl border border-iffy/30 bg-iffy/[0.06] px-5 py-4">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-iffy">
              <span>⚠</span> read the ranking honestly
            </div>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-dim">
              This is <span className="text-ink">{cr.author}&apos;s own benchmark</span>, and {cr.author}{" "}
              ranks itself #1 — on <span className="text-ink">recall</span>. It catches the most bugs
              ({topRecall.recall}%) by commenting the most, but ~{(100 - topRecall.precision).toFixed(0)}% of its
              comments are noise ({topRecall.precision}% precision). Rank by{" "}
              <span className="text-ink">F1</span> — which balances catching bugs against crying wolf — and
              it&apos;s a near three-way tie ({topF1.f1}, {[...cr.reviewers].sort((a, b) => b.f1 - a.f1)[1].name}{" "}
              {[...cr.reviewers].sort((a, b) => b.f1 - a.f1)[1].f1}). {topPrec.name} is the most precise
              ({topPrec.precision}%). We default the table to F1 — sort by precision to see it flip.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Reviewers
              <span className="ml-2 font-mono text-sm font-normal text-faint">· ranked by F1</span>
            </h2>
            <a href={cr.source} target="_blank" rel="noreferrer" className="font-mono text-xs text-faint hover:text-accent">
              source: {cr.author} benchmark ↗
            </a>
          </div>
          <CodeReviewTable reviewers={cr.reviewers} totalBugs={cr.totalBugs} />

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-edge bg-surface/40 p-5">
              <div className="font-display text-base font-semibold text-ink">How it&apos;s measured</div>
              <p className="mt-2 text-[13px] leading-relaxed text-faint">
                Each PR contains a real, merged bug-fix from {cr.repoList.join(", ")}. The pre-fix diff is
                replayed into a clean fork and every tool reviews it at default settings — no custom rules,
                full repo context. A bug counts as caught only if a line-level comment pinpoints the faulty
                code and explains its impact, and ≥2 of {cr.judges} independent LLM judges agree.
              </p>
            </div>
            <div className="rounded-xl border border-edge bg-surface/40 p-5">
              <div className="font-display text-base font-semibold text-ink">Reviewers vs coding agents</div>
              <p className="mt-2 text-[13px] leading-relaxed text-faint">
                Five are dedicated review tools (Tenki, CodeRabbit, Greptile, Copilot, Graphite); two are{" "}
                coding agents pointed at review (Devin, Cursor) — the same Cursor that shows up on the{" "}
                <Link href="/agents" className="text-dim underline-offset-2 hover:text-accent hover:underline">
                  coding-agent board
                </Link>
                . The coding agents post fewer, higher-precision comments; the dedicated reviewers cast a
                wider net.
              </p>
            </div>
          </div>

          <p className="mt-6 max-w-2xl font-mono text-[11px] leading-relaxed text-faint">
            One source for now (the only public code-review benchmark). Snapshot verified {cr.updated}; it
            refreshes as the benchmark updates or a second, independent one appears.
          </p>
        </section>
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}
