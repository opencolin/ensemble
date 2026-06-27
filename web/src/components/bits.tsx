import type { Tier } from "@/lib/types";
import { TIER_META } from "@/lib/types";

/* Tier → literal Tailwind classes (literals so the JIT picks them up). */
export const TIER_CLASS: Record<
  Tier,
  { text: string; chip: string; bar: string; glow: string }
> = {
  excellent: {
    text: "text-excellent",
    chip: "text-excellent bg-excellent/10 ring-1 ring-inset ring-excellent/25",
    bar: "bg-excellent",
    glow: "shadow-[0_0_0_1px_rgba(52,211,153,0.25)]",
  },
  solid: {
    text: "text-solid",
    chip: "text-solid bg-solid/10 ring-1 ring-inset ring-solid/25",
    bar: "bg-solid",
    glow: "shadow-[0_0_0_1px_rgba(251,191,36,0.22)]",
  },
  iffy: {
    text: "text-iffy",
    chip: "text-iffy bg-iffy/10 ring-1 ring-inset ring-iffy/25",
    bar: "bg-iffy",
    glow: "shadow-[0_0_0_1px_rgba(251,113,133,0.2)]",
  },
};

export function TierChip({ tier, className = "" }: { tier: Tier; className?: string }) {
  const t = TIER_META[tier];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${TIER_CLASS[tier].chip} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${TIER_CLASS[tier].bar}`} />
      {t.label}
    </span>
  );
}

/* Horizontal value bar in [0,1] with a numeric trailing label. */
export function StatBar({
  value,
  tone = "accent",
  label,
  animate = true,
}: {
  value: number;
  tone?: "accent" | Tier | "dim";
  label?: string;
  animate?: boolean;
}) {
  const fill =
    tone === "accent"
      ? "bg-accent"
      : tone === "dim"
        ? "bg-edge2"
        : TIER_CLASS[tone].bar;
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge/70">
        <div
          className={`h-full rounded-full ${fill} ${animate ? "bar-fill" : ""}`}
          style={{ width: `${Math.max(2, Math.round(value * 100))}%` }}
        />
      </div>
      {label !== undefined && (
        <span className="tnum w-9 shrink-0 text-right font-mono text-xs text-dim">
          {label}
        </span>
      )}
    </div>
  );
}

export function OpenWeightBadge() {
  return (
    <span className="rounded border border-edge px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-faint">
      open
    </span>
  );
}

export function ReasoningBadge() {
  return (
    <span className="rounded border border-accent-dim/40 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-accent/80">
      reasoning
    </span>
  );
}

export function Rank({ rank }: { rank: number }) {
  const top = rank <= 3;
  return (
    <span
      className={`tnum font-display text-lg font-semibold ${
        top ? "text-ink" : "text-faint"
      }`}
    >
      {top && <span className="text-accent">#</span>}
      {rank}
    </span>
  );
}
