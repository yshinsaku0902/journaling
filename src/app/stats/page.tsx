import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getYearDistances } from "@/lib/store";
import { sumKm } from "@/lib/stats";
import { SignInPrompt } from "@/components/SignInPrompt";
import { DistanceBarChart } from "@/components/DistanceBarChart";
import { todayJst } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <SignInPrompt />;

  const sp = await searchParams;
  const parsed = Number(sp.year);
  const year =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
      ? parsed
      : Number(todayJst().slice(0, 4));

  const monthly = await getYearDistances(user.id, year);
  const yearTotal = sumKm(monthly);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-navy hover:underline">
          ← カレンダー
        </Link>
        <span className="text-xs text-gray-500">{user.name}</span>
      </header>

      <section className="mt-4 bg-white rounded-2xl shadow-sm border border-rule p-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/stats?year=${year - 1}`}
            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="前の年"
          >
            ‹
          </Link>
          <h2 className="text-xl font-bold tracking-wide">{year}年の走行距離</h2>
          <Link
            href={`/stats?year=${year + 1}`}
            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="次の年"
          >
            ›
          </Link>
        </div>

        <div className="mt-5">
          <DistanceBarChart monthly={monthly} />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-rule pt-3 text-sm">
          <span className="text-gray-600">🏃 年間合計</span>
          <span className="font-bold text-navy tabular-nums">
            {yearTotal.toFixed(1)} km
          </span>
        </div>
      </section>
    </main>
  );
}
