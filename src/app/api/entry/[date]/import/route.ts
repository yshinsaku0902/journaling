import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { importOutlook } from "@/lib/store";
import { fetchOutlookEvents, mockOutlookEvents } from "@/lib/graph";
import { isValidDateStr } from "@/lib/date";
import { DEMO_MODE } from "@/lib/env";
import type { OutlookEventInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!isValidDateStr(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let events: OutlookEventInput[];
  if (DEMO_MODE) {
    events = mockOutlookEvents(date);
  } else {
    if (user.authError || !user.accessToken) {
      return NextResponse.json(
        { error: "reauth", message: "Microsoftへの再ログインが必要です。" },
        { status: 401 },
      );
    }
    try {
      events = await fetchOutlookEvents(user.accessToken, date);
    } catch (e) {
      return NextResponse.json(
        { error: "graph", message: String(e) },
        { status: 502 },
      );
    }
  }

  const entry = await importOutlook(user.id, date, events);
  return NextResponse.json({ entry, imported: events.length });
}
