// 現在のユーザーを取得。デモモードでは固定のデモユーザーを返す。
import { DEMO_MODE } from "./env";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  accessToken?: string;
  authError?: string;
}

const DEMO_USER: AppUser = {
  id: "demo",
  email: "demo@local",
  name: "山岸 晋作（デモ）",
};

export async function getCurrentUser(): Promise<AppUser | null> {
  if (DEMO_MODE) return DEMO_USER;

  const { auth } = await import("@/auth");
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const s = session as unknown as Record<string, unknown>;
  return {
    id: email,
    email,
    name: session.user?.name ?? email,
    accessToken: s.accessToken as string | undefined,
    authError: s.error as string | undefined,
  };
}
