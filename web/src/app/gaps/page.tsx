import type { Metadata } from "next";
import Link from "next/link";
import type { Harness } from "@/lib/types";
import { getLeaderboard } from "@/lib/leaderboard";
import { getHarness, boardByHarness, slugFor } from "@/lib/select";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Coverage gaps — ixio",
  description: "The (harness × model) combinations no public benchmark has run — especially model-agnostic harnesses with open models.",
};

// Harnesses worth showing: model-agnostic CLIs/TUIs people actually use.
const HARNESS_IDS = ["claude-code", "codex-cli", "opencode", "aider", "gemini-cli", "goose", "crush", "openhands", "terminus-2", "mini-swe-agent"];

function MetaChip({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{k}</span>
      <span className={`font-display text-2xl font-semibold ${accent ? "text-accent" : "text-ink"}`}>{v}</span>
    </div>
  );
}

export default async function GapsPage() {
  const lb = await getLeaderboard();
  const harnesses = HARNESS_IDS.map((id) => getHarness(lb, id)).filter((h): h is Harness => !!h);
  const models = lb.models.filter((m) => m.openWeight).slice(0, 16);

  const tested = (hid: string, mid: string) => !!boardByHarness(lb, hid)?.models.some((m) => m.modelId === mid);

  const total = harnesses.length * models.length;
  const filled = harnesses.reduce((s, h) => s + models.filter((m) => tested(h.id, m.modelId)).length, 0);
  const missing = total - filled;
  const claudeMissing = models.filter((m) => !tested("claude-code", m.modelId));
  const codexMissing = models.filter((m) => !tested("codex-cli", m.modelId));
  const miniMissing = models.filter((m) => !tested("mini-swe-agent", m.modelId));

  const grid = `10rem repeat(${models.length}, 2.4rem)`;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-accent">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            COVERAGE GAPS · what nobody has run
          </div>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            The tests <span className="text-accent">nobody has run</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-dim">
            A coding agent is a model + a harness, and most harnesses are model-agnostic — Claude
            Code, Codex, opencode can all drive any model. But public benchmarks rarely pair them
            with open-weight models. Below: top open models (columns) × the harnesses that could run
            them (rows). Filled = a benchmark tested it; empty = a gap we&apos;d have to{" "}
            <span className="text-ink">run ourselves</span>.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-edge/70 pt-6 sm:grid-cols-4">
            <MetaChip k="Combos shown" v={`${total}`} />
            <MetaChip k="Tested" v={`${filled}`} />
            <MetaChip k="Missing" v={`${missing}`} accent />
            <MetaChip k="Claude Code · open" v={`${models.length - claudeMissing.length} / ${models.length}`} accent />
          </div>
        </section>

        {/* matrix */}
        <section className="mx-auto max-w-6xl px-5 py-4">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 160 + models.length * 38 }}>
              {/* model header */}
              <div className="grid items-end gap-x-1 pb-2" style={{ gridTemplateColumns: grid }}>
                <span />
                {models.map((m) => (
                  <div key={m.modelId} className="h-28 [writing-mode:vertical-rl] rotate-180 pb-1 font-mono text-[11px] text-dim">
                    <span className="truncate">{m.modelName}</span>
                  </div>
                ))}
              </div>
              {harnesses.map((h) => {
                const n = models.filter((m) => tested(h.id, m.modelId)).length;
                const hot = h.id === "claude-code" || h.id === "codex-cli" || h.id === "mini-swe-agent";
                return (
                  <div key={h.id} className="grid items-center gap-x-1 border-t border-edge/50 py-1.5" style={{ gridTemplateColumns: grid }}>
                    <Link href={`/agents/${h.id}`} className={`truncate pr-2 font-mono text-[12px] hover:text-accent ${hot ? "text-ink" : "text-dim"}`} title={h.name}>
                      {h.name} <span className="text-faint">{n}/{models.length}</span>
                    </Link>
                    {models.map((m) => {
                      const t = tested(h.id, m.modelId);
                      return (
                        <div key={m.modelId} className="flex items-center justify-center">
                          <span className={`size-3 rounded-sm ${t ? "bg-excellent/80" : hot ? "bg-iffy/25 ring-1 ring-inset ring-iffy/40" : "bg-edge"}`} title={`${h.name} × ${m.modelName}: ${t ? "tested" : "missing"}`} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 font-mono text-[11px] text-faint">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-excellent/80" /> tested</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-iffy/25 ring-1 ring-inset ring-iffy/40" /> gap (priority rows)</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-edge" /> untested</span>
          </div>
        </section>

        {/* priority list */}
        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="font-display text-lg font-semibold tracking-tight">Priority gaps to run</h2>
          <p className="mt-1 text-[13px] text-faint">
            The highest-value runs: pair a top harness with a top open model nobody has benchmarked.
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <GapCard title="mini-SWE-agent × open models" sub={`${miniMissing.length} of ${models.length} untested — our own runner, so these are one command away.`} models={miniMissing.map((m) => m.modelName)} />
            <GapCard title="Claude Code × open models" sub={`${claudeMissing.length} of ${models.length} untested — public benchmarks pair it only with Claude.`} models={claudeMissing.map((m) => m.modelName)} />
            <GapCard title="Codex × open models" sub={`${codexMissing.length} of ${models.length} untested.`} models={codexMissing.map((m) => m.modelName)} />
          </div>
          <p className="mt-6 max-w-2xl font-mono text-[11px] leading-relaxed text-faint">
            Green cells in our rows come from{" "}
            <span className="text-dim">ixio runs</span>: mini-SWE-agent drives the model inside an
            isolated microVM (ConTree or Tenki Sandbox), graded against hidden tests — models served
            by Token Factory or the Vercel AI Gateway, so any model on either can fill a cell. The
            Claude Code row&apos;s green came from our earlier claude-code-proxy runs. Red cells are
            the queue.
          </p>
        </section>
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}

function GapCard({ title, sub, models }: { title: string; sub: string; models: string[] }) {
  return (
    <div className="rounded-xl border border-edge bg-surface/50 p-5">
      <div className="font-display text-base font-semibold text-ink">{title}</div>
      <p className="mt-1 text-[13px] text-dim">{sub}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {models.map((m) => (
          <span key={m} className="rounded border border-iffy/30 bg-iffy/5 px-2 py-0.5 font-mono text-[11px] text-dim">{m}</span>
        ))}
        {!models.length && <span className="font-mono text-[12px] text-excellent">all covered ✓</span>}
      </div>
    </div>
  );
}
