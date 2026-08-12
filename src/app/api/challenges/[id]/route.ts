import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { deleteChallenge, updateChallenge } from "@/lib/store";
import { toChallengePatch } from "@/lib/validate";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const patch = toChallengePatch(body);
  if (patch.text !== undefined && !patch.text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const challenge = await updateChallenge(user.id, id, patch);
  if (!challenge) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ challenge });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await deleteChallenge(user.id, id);
  return NextResponse.json({ ok: true });
}
