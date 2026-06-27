"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Harness } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";

/** Inline dropdown rendered inside the hero headline — swaps the active harness. */
export function HarnessSwitcher({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Harness[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const current = options.find((o) => o.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block whitespace-nowrap">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="group inline-flex items-baseline gap-[0.15em] text-accent underline decoration-accent/30 decoration-[3px] underline-offset-[7px] outline-none transition hover:decoration-accent/80 focus-visible:decoration-accent"
      >
        {current.name}
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className={`size-[0.42em] self-center transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="rise absolute left-0 top-full z-40 mt-4 w-72 overflow-hidden rounded-xl border border-edge2 bg-surface2 text-left shadow-2xl shadow-black/60"
        >
          <div className="border-b border-edge px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-faint">
            Choose your agent harness
          </div>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-edge/50 ${
                o.id === value ? "bg-edge/30" : ""
              }`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
                  {o.name}
                  {o.id === value && <span className="size-1.5 rounded-full bg-accent" />}
                </span>
                <span className="truncate font-mono text-[11px] text-faint">
                  {o.vendor}
                </span>
              </span>
              <span className="shrink-0 rounded border border-edge px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-dim">
                {KIND_LABEL[o.kind]}
              </span>
            </button>
          ))}
          <Link
            href="/agents"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-3 border-t border-edge px-3 py-2.5 text-[14px] font-medium text-dim transition-colors hover:bg-edge/50 hover:text-accent"
          >
            More options
            <span aria-hidden className="font-mono text-xs">→</span>
          </Link>
        </div>
      )}
    </span>
  );
}
