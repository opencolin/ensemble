"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Mark({ className = "" }: { className?: string }) {
  // Three rising bars — an equalizer / leaderboard motif.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <rect x="3" y="13" width="4.2" height="8" rx="1.3" fill="currentColor" opacity="0.55" />
      <rect x="9.9" y="8" width="4.2" height="13" rx="1.3" fill="currentColor" opacity="0.8" />
      <rect x="16.8" y="3" width="4.2" height="18" rx="1.3" fill="currentColor" />
    </svg>
  );
}

const NAV = [
  { href: "/", label: "Top Model" },
  { href: "/agents", label: "Top Agent" },
  { href: "/team", label: "Top Team" },
  { href: "/code-review", label: "Code Review" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/gaps", label: "Gaps" },
  { href: "/#method", label: "Method" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-edge/70 bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <Mark className="size-5 text-accent transition-transform group-hover:scale-110" />
          <span className="font-display text-[15px] font-semibold tracking-tight">ixio</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-dim">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href.replace(/#.*$/, "")) && n.href !== "/#method";
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-3 py-1.5 transition-colors hover:bg-surface hover:text-ink ${
                  active ? "text-ink" : ""
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          <a
            href="https://github.com/KiranChilledOut/claude-code-proxy"
            target="_blank"
            rel="noreferrer"
            className="ml-1 rounded-md border border-edge px-3 py-1.5 text-ink transition-colors hover:border-edge2 hover:bg-surface"
          >
            Proxy ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
