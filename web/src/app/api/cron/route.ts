import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Hit daily by the Vercel cron (see vercel.json). Marks the ISR pages stale so
// the next render re-scrapes the sources. Optionally protected by CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  const paths = ["/", "/agents", "/team"];
  for (const p of paths) revalidatePath(p);
  revalidatePath("/models/[id]", "page");
  return NextResponse.json({ ok: true, revalidated: [...paths, "/models/[id]"], at: new Date().toISOString() });
}
