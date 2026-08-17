import { Fragment } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getMonthStats, getMonthlyGoal, listChallenges } from "@/lib/store";
import { sumKm } from "@/lib/stats";
import { SignInPrompt } from "@/components/SignInPrompt";
import { SearchBox } from "@/components/SearchBox";
import { MonthlyGoalInput } from "@/components/MonthlyGoalInput";
import { ChallengeBoard } from "@/components/ChallengeBoard";
import { UndoneTodos } from "@/components/UndoneTodos";
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

  // 距離バーの高さスケール用（その月の最大距離）
  const maxDist = Math.max(0, ...Object.values(stats.distanceByDate));

  // ミニ統計・達成メーター用
  const isCurrentMonth = ymOf(today) === ym;
  const recordedDays = Object.keys(stats.content).length;
  // 記入率の分母は「経過日数（今月）／その月の日数（過去月）」
  const elapsedDays = isCurrentMonth ? jpDateParts(today).day : daysInMonth;
  const recordPct =
    elapsedDays > 0
      ? Math.min(100, Math.round((recordedDays / elapsedDays) * 100))
      : 0;
  const distancePct =
    goal != null && goal > 0
      ? Math.min(100, Math.round((monthTotal / goal) * 100))
      : null;
  const medalCount = weeks.filter(weekMedal).length;

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

        {/* ミニ統計サマリー */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-gradient-to-b from-navy/5 to-transparent border border-rule px-2 py-2 text-center">
            <div className="text-lg font-bold leading-none text-navy tabular-nums">
              {recordedDays}
              <span className="text-[10px] font-medium text-gray-400">日</span>
            </div>
            <div className="mt-1 text-[10px] text-gray-500">📝 今月の記入</div>
          </div>
          <div className="rounded-xl bg-gradient-to-b from-accent/5 to-transparent border border-rule px-2 py-2 text-center">
            <div className="text-lg font-bold leading-none text-accent tabular-nums">
              {monthTotal.toFixed(1)}
              <span className="text-[10px] font-medium text-gray-400">km</span>
            </div>
            <div className="mt-1 text-[10px] text-gray-500">🏃 走行距離</div>
          </div>
          <div className="rounded-xl bg-gradient-to-b from-amber-100/60 to-transparent border border-rule px-2 py-2 text-center">
            <div className="flex items-center justify-center gap-0.5 text-lg font-bold leading-none tabular-nums text-amber-600">
              {distancePct != null ? (
                <>
                  {distancePct}
                  <span className="text-[10px] font-medium text-gray-400">%</span>
                </>
              ) : (
                <>
                  {medalCount}
                  <span className="text-[10px] font-medium text-gray-400">個</span>
                </>
              )}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">
              {distancePct != null ? "🎯 目標達成" : "🏅 週メダル"}
            </div>
          </div>
        </div>

        {/* 記入率メーター */}
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-[11px]">
            <span className="text-gray-500">
              {isCurrentMonth ? "今月ここまでの記入" : "この月の記入"}
            </span>
            <span className="font-bold tabular-nums text-navy">
              {recordedDays}/{elapsedDays}日
              <span className="ml-1 text-gray-400">({recordPct}%)</span>
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-navy to-navy/70 transition-all"
              style={{ width: `${recordPct}%` }}
            />
          </div>
          {distancePct != null && (
            <>
              <div className="mb-1 mt-2 flex items-baseline justify-between text-[11px]">
                <span className="text-gray-500">距離目標</span>
                <span className="font-bold tabular-nums text-accent">
                  {monthTotal.toFixed(1)}/{goal}km
                  <span className="ml-1 text-gray-400">({distancePct}%)</span>
                  {distancePct >= 100 && (
                    <span className="sparkle-pop ml-1 inline-block" aria-label="目標達成">
                      🎉
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-amber-500 transition-all"
                  style={{ width: `${distancePct}%` }}
                />
              </div>
            </>
          )}
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
                const goalText = stats.goalByDate[date];
                const undone = stats.undoneByDate[date] ?? 0;
                return (
                  <Link
                    key={date}
                    href={`/journal/${date}`}
                    title={
                      (goalText ? `${month}/${day} ${goalText}` : `${month}/${day}`) +
                      (undone > 0 ? ` / 未完了TODO ${undone}件` : "")
                    }
                    className={`group relative flex min-h-[3.6rem] flex-col overflow-hidden rounded-lg border px-1 pb-1 pt-0.5 transition
                      ${
                        isToday
                          ? "today-glow border-navy bg-navy/5"
                          : "border-transparent hover:bg-gray-100"
                      }`}
                  >
                    {/* 未完了TODOバッジ */}
                    {undone > 0 && (
                      <span
                        className="absolute right-0.5 top-0.5 z-20 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                        aria-label={`未完了TODO ${undone}件`}
                      >
                        {undone}
                      </span>
                    )}
                    {/* 距離バー（下から伸びる） */}
                    {dist != null && maxDist > 0 && (
                      <span
                        aria-hidden
                        className="bar-rise absolute inset-x-0 bottom-0 bg-gradient-to-t from-accent/45 to-accent/10"
                        style={{
                          height: `${Math.max(18, (dist / maxDist) * 100)}%`,
                        }}
                      />
                    )}
                    {/* 日付 */}
                    <span
                      className={`relative z-10 text-xs leading-none ${
                        weekdayIndex === 0
                          ? "text-accent"
                          : weekdayIndex === 6
                            ? "text-blue-600"
                            : "text-gray-800"
                      } ${isToday ? "font-bold" : ""}`}
                    >
                      {day}
                    </span>
                    {/* 大切にすること（その日の最重点目標） */}
                    {goalText && (
                      <span className="relative z-10 mt-0.5 line-clamp-2 break-words text-[8px] leading-tight text-navy/70">
                        {goalText}
                      </span>
                    )}
                    {/* 距離の数値 */}
                    {dist != null ? (
                      <span className="relative z-10 mt-auto text-[9px] font-bold leading-none text-accent tabular-nums">
                        {dist.toFixed(1)}
                        <span className="text-[7px]">km</span>
                      </span>
                    ) : has && !goalText ? (
                      <span className="relative z-10 mt-auto h-1.5 w-1.5 rounded-full bg-gray-300" />
                    ) : null}
                  </Link>
                );
              })}
              <div className="flex flex-col items-center justify-center gap-0.5">
                {weekMedal(week) && (
                  <span
                    className="sparkle-pop text-2xl leading-none"
                    title="週目標達成！"
                    aria-label="週目標達成"
                  >
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
      </section>

      {/* やり残しTODO（未完了）まとめ・その場で完了/削除できる */}
      <UndoneTodos initial={stats.undoneTodos} />

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

      <section className="mt-6">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-base font-bold text-navy">🧭 経営課題</h2>
          <span className="text-[11px] text-gray-400">
            気づきを書き留めて忘れない
          </span>
        </div>
        <ChallengeBoard initialChallenges={challenges} />
      </section>
    </main>
  );
}
