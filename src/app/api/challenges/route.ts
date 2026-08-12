import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { addChallenge, listChallenges } from "@/lib/store";
import { toChallengeInput } from "@/lib/validate";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const challenges = await listChallenges(user.id);
  return NextResponse.json({ challenges });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const input = toChallengeInput(body);
  if (!input.text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const challenge = await addChallenge(user.id, input);
  return NextResponse.json({ challenge }, { status: 201 });
}
