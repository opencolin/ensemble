import { getLeaderboard } from "@/lib/leaderboard";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeBoard } from "@/components/HomeBoard";
import { Methodology } from "@/components/Methodology";
import { SiteFooter } from "@/components/SiteFooter";

export const revalidate = 86400;

export default async function Home() {
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
