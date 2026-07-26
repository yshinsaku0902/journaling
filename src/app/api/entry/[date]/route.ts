import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getEntry, saveEntry } from "@/lib/store";
import { isValidDateStr } from "@/lib/date";
import { toEntryPatch } from "@/lib/validate";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!isValidDateStr(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const entry = await getEntry(user.id, date);
  return NextResponse.json(entry);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!isValidDateStr(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const patch = toEntryPatch(body);
  const entry = await saveEntry(user.id, date, patch);
  return NextResponse.json(entry);
}
