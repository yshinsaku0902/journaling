import { Fragment } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getMonthStats, getMonthlyGoal, listChallenges } from "@/lib/store";
import { sumKm } from "@/lib/stats";
import { SignInPrompt } from "@/components/SignInPrompt";
import { SearchBox } from "@/components/SearchBox";
import { MonthlyGoalInput } from "@/components/MonthlyGoalInput";
import { ChallengeBoard } from "@/components/ChallengeBoard";
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

  const stats = await getMonthStats(user.id, year, month);
  const goal = await getMonthlyGoal(user.id, ym);
  const challenges = await listChallenges(user.id);
  const grid = monthGrid(year, month);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7));

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // 月目標の1日あたりペース（目標未設定なら null）
  const dailyTarget = goal != null && goal > 0 ? goal / daysInMonth : null;

  const weekTotal = (week: (string | null)[]) =>
    sumKm(week.map((d) => (d ? stats.distanceByDate[d] : null)));
  // その週の目標（1日ペース×その週の在月日数）。達成でメダル。
  const weekMedal = (week: (string | null)[]) => {
    if (dailyTarget == null) return false;
    const inMonthDays = week.filter(Boolean).length;
    const target = dailyTarget * inMonthDays;
    return target > 0 && weekTotal(week) >= target;
  };
  const monthTotal = sumKm(Object.values(stats.distanceByDate));

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

        <div className="mt-3">
          <MonthlyGoalInput
            ym={ym}
            initialGoal={goal}
            daysInMonth={daysInMonth}
          />
        </div>

        <div className="mt-4 grid grid-cols-8 gap-1 text-center">
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
          <div className="py-1 text-[10px] font-medium text-navy self-center">
            週計
          </div>

          {weeks.map((week, wi) => (
            <Fragment key={`w${wi}`}>
              {week.map((date, idx) => {
                if (!date) return <div key={`e${wi}-${idx}`} />;
                const { day, weekdayIndex } = jpDateParts(date);
                const isToday = date === today;
                const dist = stats.distanceByDate[date];
                const has = stats.content[date];
                return (
                  <Link
                    key={date}
                    href={`/journal/${date}`}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-lg border transition
                      ${isToday ? "border-navy bg-navy/5" : "border-transparent hover:bg-gray-100"}
                    `}
                  >
                    <span
                      className={`text-sm leading-none ${
                        weekdayIndex === 0
                          ? "text-accent"
                          : weekdayIndex === 6
                            ? "text-blue-600"
                            : "text-gray-800"
                      } ${isToday ? "font-bold" : ""}`}
                    >
                      {day}
                    </span>
                    {dist != null ? (
                      <span className="mt-0.5 text-[10px] font-bold leading-none text-accent tabular-nums">
                        {dist.toFixed(1)}
                      </span>
                    ) : has ? (
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-300" />
                    ) : null}
                  </Link>
                );
              })}
              <div className="flex flex-col items-center justify-center gap-0.5">
                {weekMedal(week) && (
                  <span className="text-2xl leading-none" title="週目標達成！" aria-label="週目標達成">
                    🏅
                  </span>
                )}
                {weekTotal(week) > 0 && (
                  <span className="text-xs font-bold text-navy tabular-nums">
                    {weekTotal(week).toFixed(1)}
                  </span>
                )}
              </div>
            </Fragment>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-rule pt-3 text-sm">
          <span className="text-gray-600">🏃 月間走行距離</span>
          <span className="font-bold text-navy tabular-nums">
            {monthTotal.toFixed(1)} km
          </span>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-base font-bold text-navy">🧭 経営課題</h2>
          <span className="text-[11px] text-gray-400">
            気づきを書き留めて忘れない
          </span>
        </div>
        <ChallengeBoard initialChallenges={challenges} />
      </section>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          href={`/journal/${today}`}
          className="inline-block rounded-xl bg-navy text-white px-6 py-3 font-medium shadow-sm hover:opacity-90 transition"
        >
          今日のジャーナルを書く
        </Link>
        <Link
          href={`/stats?year=${year}`}
          className="text-sm text-navy underline underline-offset-2 hover:opacity-80"
        >
          📊 走行距離グラフを見る
        </Link>
      </div>
    </main>
  );
}
