"use client";

export type Weights = "all" | "open";

/** Segmented all-models / open-weight filter, matching the harness-switcher pill style. */
export function OpenFilter({ value, onChange, labels }: {
  value: Weights;
  onChange: (v: Weights) => void;
  /** Display labels for the [all, open] segments (default "All" / "Open"). */
  labels?: [string, string];
}) {
  const [allLabel, openLabel] = labels ?? ["All", "Open"];
  return (
    <div className="flex items-center gap-1 rounded-lg border border-edge bg-surface/60 p-1" role="group" aria-label="weights filter">
      {(["all", "open"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === v ? "bg-edge2/60 text-ink" : "text-faint hover:text-dim"
          }`}
        >
          {v === "all" ? allLabel : openLabel}
        </button>
      ))}
    </div>
  );
}
