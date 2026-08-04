import type { Metadata } from "next";
import { HomeHero } from "@/components/HomeHero";

export const metadata: Metadata = {
  title: "ixio — Agent Native Infrastructure",
  description:
    "Disposable sandboxes, agent code review, and GitHub runners on demand. Use it, break it, walk away — it turns to sand.",
};

export default function Home() {
  return <HomeHero />;
}
