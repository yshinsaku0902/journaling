import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getMonthSummary } from "@/lib/store";
import { SignInPrompt } from "@/components/SignInPrompt";
import { SearchBox } from "@/components/SearchBox";
import {
  todayJst,
  ymOf,
  parseYm,
  addMonths,
  monthGrid,
  jpDateParts,
  WEEKDAY_LABELS,
} from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <SignInPrompt />;

  const today = todayJst();
  const sp = await searchParams;
  const ym = sp.ym && parseYm(sp.ym) ? sp.ym : ymOf(today);
  const { year, month } = parseYm(ym)!;

  const summary = await getMonthSummary(user.id, year, month);
  const grid = monthGrid(year, month);

  const prevYm = addMonths(ym, -1);
  const nextYm = addMonths(ym, 1);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">ジャーナル手帳</h1>
        <span className="text-xs text-gray-500">{user.name}</span>
      </header>

      <div className="mt-3">
        <SearchBox />
      </div>

      <section className="mt-4 bg-white rounded-2xl shadow-sm border border-rule p-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/?ym=${prevYm}`}
            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="前の月"
          >
            ‹
          </Link>
          <h2 className="text-xl font-bold tracking-wide">
            {year}年 {month}月
          </h2>
          <Link
            href={`/?ym=${nextYm}`}
            className="px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="次の月"
          >
            ›
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((w, i) => (
            <div
              key={w}
              className={`text-xs font-medium py-1 ${
                i === 0 ? "text-accent" : i === 6 ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {w}
            </div>
          ))}

          {grid.map((date, idx) => {
            if (!date) return <div key={`e${idx}`} />;
            const { day, weekdayIndex } = jpDateParts(date);
            const isToday = date === today;
            const has = summary[date];
            return (
              <Link
                key={date}
                href={`/journal/${date}`}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-lg border transition
                  ${isToday ? "border-navy bg-navy/5" : "border-transparent hover:bg-gray-100"}
                `}
              >
                <span
                  className={`text-sm ${
                    weekdayIndex === 0
                      ? "text-accent"
                      : weekdayIndex === 6
                        ? "text-blue-600"
                        : "text-gray-800"
                  } ${isToday ? "font-bold" : ""}`}
                >
                  {day}
                </span>
                {has && (
                  <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-6 text-center">
        <Link
          href={`/journal/${today}`}
          className="inline-block rounded-xl bg-navy text-white px-6 py-3 font-medium shadow-sm hover:opacity-90 transition"
        >
          今日のジャーナルを書く
        </Link>
      </div>
    </main>
  );
}
