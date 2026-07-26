// Auth.js (NextAuth v5) 設定。
// 1回の Microsoft ログインで「アプリの鍵」と「Graph 用アクセストークン」を兼ねる。
// デモモード（Azure 資格情報なし）では providers 空で、実際には呼ばれない。
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { DEMO_MODE } from "@/lib/env";

const SCOPE = "openid profile email offline_access Calendars.Read";

async function refreshAccessToken(
  token: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID as string,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET as string,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken as string,
      scope: SCOPE,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    if (!res.ok) return { ...token, error: "RefreshAccessTokenError" };
    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in),
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: DEMO_MODE
    ? []
    : [
        MicrosoftEntraID({
          clientId: process.env.AZURE_AD_CLIENT_ID,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
          issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
          authorization: { params: { scope: SCOPE } },
        }),
      ],
  callbacks: {
    async signIn({ profile }) {
      const allow = process.env.ALLOWED_EMAILS?.split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (!allow || allow.length === 0) return true;
      const p = profile as Record<string, unknown> | undefined;
      const email = String(
        p?.email || p?.preferred_username || p?.upn || "",
      ).toLowerCase();
      return allow.includes(email);
    },
    async jwt({ token, account }) {
      const t = token as Record<string, unknown>;
      if (account) {
        t.accessToken = account.access_token;
        t.refreshToken = account.refresh_token;
        t.expiresAt = account.expires_at;
        return t;
      }
      const expiresAt = t.expiresAt as number | undefined;
      if (expiresAt && Date.now() < expiresAt * 1000 - 60_000) {
        return t;
      }
      if (t.refreshToken) return await refreshAccessToken(t);
      return t;
    },
    async session({ session, token }) {
      const t = token as Record<string, unknown>;
      const s = session as unknown as Record<string, unknown>;
      s.accessToken = t.accessToken;
      s.error = t.error;
      return session;
    },
  },
});
