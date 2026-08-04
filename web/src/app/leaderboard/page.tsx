import type { Metadata } from "next";
import { getLeaderboard } from "@/lib/leaderboard";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeBoard } from "@/components/HomeBoard";
import { Methodology } from "@/components/Methodology";
import { SiteFooter } from "@/components/SiteFooter";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Top Model — ixio",
  description:
    "A leaderboard ranking LLMs as coding agents. Same harness, swapped model, measured on real coding tasks.",
};

export default async function LeaderboardPage() {
  const lb = await getLeaderboard();
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <HomeBoard lb={lb} />
        <Methodology lb={lb} />
      </main>
      <SiteFooter meta={lb.meta} />
    </>
  );
}
