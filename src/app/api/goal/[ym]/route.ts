import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getMonthlyGoal, setMonthlyGoal } from "@/lib/store";
import { parseYm } from "@/lib/date";
import { nullableNum } from "@/lib/validate";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ym: string }> },
) {
  const { ym } = await params;
  if (!parseYm(ym)) {
    return NextResponse.json({ error: "invalid ym" }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const distanceGoalKm = await getMonthlyGoal(user.id, ym);
  return NextResponse.json({ ym, distanceGoalKm });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ ym: string }> },
) {
  const { ym } = await params;
  if (!parseYm(ym)) {
    return NextResponse.json({ error: "invalid ym" }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const raw = nullableNum((body as { distanceGoalKm?: unknown })?.distanceGoalKm, 0, 10000);
  const km = raw && raw > 0 ? raw : null; // 0/空はクリア扱い
  const distanceGoalKm = await setMonthlyGoal(user.id, ym, km);
  return NextResponse.json({ ym, distanceGoalKm });
}
