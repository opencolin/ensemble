// Code-review agents — a distinct category from coding agents: tools that review
// a PR and catch real bugs, not write code. The only public benchmark so far is
// Tenki's (tenki.cloud/benchmarks/code-reviewer). Caveat: Tenki authored it and
// ranks itself #1 — but only on RECALL. We rank by F1 (recall × precision), where
// the picture is a tight three-way race and Tenki's low precision shows.
//
// Snapshot, not a live scrape: the page renders the numbers from a deeply-nested
// Next.js RSC payload (no clean table/API), so we store the values and refresh
// them when the benchmark updates. Last verified against the live page below.

export type ReviewerKind = "reviewer" | "coding-agent";

export interface Reviewer {
  name: string;
  kind: ReviewerKind; // dedicated review tool vs a coding agent used to review
  recall: number; // % of real bugs caught
  precision: number; // % of its comments that are real bugs
  f1: number; // harmonic mean of recall + precision
  caught: number; // bugs caught (of CODE_REVIEW.totalBugs)
  homepage: string;
}

export const CODE_REVIEW = {
  benchmarkName: "Tenki Code Review Benchmark",
  source: "https://tenki.cloud/benchmarks/code-reviewer",
  author: "Tenki", // the benchmark's own author — read the ranking with that in mind
  updated: "2026-05-20",
  totalBugs: 122,
  prs: 50,
  repos: 5,
  judges: 3,
  repoList: ["cal.com (TS)", "Sentry (Python)", "Grafana (Go)", "Keycloak (Java)", "Discourse (Ruby)"],
  reviewers: [
    { name: "Tenki", kind: "reviewer", recall: 68.9, precision: 29.9, f1: 41.7, caught: 84, homepage: "https://tenki.cloud" },
    { name: "Devin", kind: "coding-agent", recall: 36.1, precision: 47.3, f1: 40.9, caught: 44, homepage: "https://devin.ai" },
    { name: "Cursor", kind: "coding-agent", recall: 32.0, precision: 51.3, f1: 39.4, caught: 39, homepage: "https://cursor.com" },
    { name: "CodeRabbit", kind: "reviewer", recall: 28.7, precision: 25.0, f1: 26.7, caught: 35, homepage: "https://coderabbit.ai" },
    { name: "Greptile", kind: "reviewer", recall: 36.1, precision: 15.9, f1: 22.1, caught: 44, homepage: "https://greptile.com" },
    { name: "Copilot", kind: "reviewer", recall: 24.6, precision: 18.9, f1: 21.4, caught: 30, homepage: "https://github.com/features/copilot" },
    { name: "Graphite", kind: "reviewer", recall: 3.3, precision: 50.0, f1: 6.2, caught: 4, homepage: "https://graphite.dev" },
  ] as Reviewer[],
};
