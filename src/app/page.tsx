import { Fragment } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getMonthStats, getMonthlyGoal, listChallenges } from "@/lib/store";
import { sumKm, summarizeRuns } from "@/lib/stats";
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
  // 走った回数・連続日数・ベストの日（ご褒美演出の材料）
  const run = summarizeRuns(stats.distanceByDate, today, isCurrentMonth);
  // ラン回数ストリップ用（1日〜月末）
  const monthDays = Array.from(
    { length: daysInMonth },
    (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`,
  );
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
          <div className="rounded-xl bg-gradient-to-b from-amber-100/60 to-transparent border border-rule px-2 py-2 text-center">
            <div className="text-lg font-bold leading-none text-amber-600 tabular-nums">
              {run.runCount}
              <span className="text-[10px] font-medium text-gray-400">回</span>
            </div>
            <div className="mt-1 text-[10px] text-gray-500">🏃 今月走った</div>
          </div>
          <div className="rounded-xl bg-gradient-to-b from-sky-500/10 to-transparent border border-rule px-2 py-2 text-center">
            <div className="text-lg font-bold leading-none text-sky-600 tabular-nums">
              {monthTotal.toFixed(1)}
              <span className="text-[10px] font-medium text-gray-400">km</span>
            </div>
            <div className="mt-1 text-[10px] text-gray-500">📏 走行距離</div>
          </div>
          <div className="rounded-xl bg-gradient-to-b from-emerald-100/60 to-transparent border border-rule px-2 py-2 text-center">
            <div className="flex items-center justify-center gap-0.5 text-lg font-bold leading-none tabular-nums text-emerald-600">
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

        {/* 走った日ストリップ（1日〜月末を1マスずつ。走った日だけ塗る） */}
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-[11px]">
            <span className="text-gray-500">走った日</span>
            <span className="font-bold tabular-nums text-amber-600">
              {run.runCount}
              <span className="text-gray-400">/{daysInMonth}日</span>
            </span>
          </div>
          <div
            className="flex gap-[2px]"
            aria-label={`今月走った日 ${run.runCount}回`}
          >
            {monthDays.map((d) => {
              const km = stats.distanceByDate[d];
              const isBig = km != null && run.avgKm > 0 && km >= run.avgKm;
              return (
                <span
                  key={d}
                  title={km != null ? `${d.slice(8)}日 ${km}km` : undefined}
                  className={`h-2 flex-1 rounded-[2px] ${
                    km != null
                      ? isBig
                        ? "bg-amber-400"
                        : "bg-sky-500"
                      : "bg-gray-100"
                  } ${d === today ? "ring-1 ring-navy/40" : ""}`}
                />
              );
            })}
          </div>
          {(run.streak >= 2 || run.bestDate) && (
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500">
              {run.streak >= 2 && (
                <span>
                  🔥 {run.streakIsCurrent ? "連続" : "最長"}
                  <span className="font-bold tabular-nums text-amber-600">
                    {run.streak}
                  </span>
                  日
                </span>
              )}
              {run.bestDate && (
                <span>
                  👑 ベスト{" "}
                  <span className="font-bold tabular-nums text-amber-600">
                    {run.bestKm.toFixed(1)}km
                  </span>
                  <span className="text-gray-400">
                    （{Number(run.bestDate.slice(8))}日）
                  </span>
                </span>
              )}
            </div>
          )}

          {distancePct != null && (
            <>
              <div className="mb-1 mt-3 flex items-baseline justify-between text-[11px]">
                <span className="text-gray-500">距離目標</span>
                <span className="font-bold tabular-nums text-sky-600">
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
                  className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all"
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
                // 走った日のご褒美：👑=月間ベスト / ⭐=平均以上 / 👟=走った日
                const ranToday = dist != null;
                const isBest = ranToday && date === run.bestDate && run.runCount >= 2;
                const isStar =
                  ranToday && !isBest && run.runCount >= 2 && dist >= run.avgKm;
                const nth = ranToday ? run.runDates.indexOf(date) + 1 : 0;
                return (
                  <Link
                    key={date}
                    href={`/journal/${date}`}
                    title={
                      (goalText ? `${month}/${day} ${goalText}` : `${month}/${day}`) +
                      (ranToday ? ` / 🏃 ${dist.toFixed(1)}km（今月${nth}回目）` : "") +
                      (undone > 0 ? ` / 未完了TODO ${undone}件` : "")
                    }
                    className={`group relative flex min-h-[3.6rem] flex-col overflow-hidden rounded-lg border px-1 pb-1 pt-0.5 transition
                      ${ranToday ? "run-day" : ""}
                      ${
                        isToday
                          ? "today-glow border-navy bg-navy/5"
                          : ranToday
                            ? "border-amber-300 bg-amber-50/60"
                            : "border-transparent hover:bg-gray-100"
                      }`}
                  >
                    {/* 走った日のご褒美マーク */}
                    {ranToday && (
                      <span
                        aria-hidden
                        className={`absolute bottom-0.5 right-0.5 z-20 text-[11px] leading-none ${
                          isBest || isStar ? "sparkle-pop" : ""
                        }`}
                      >
                        {isBest ? "👑" : isStar ? "⭐" : "👟"}
                      </span>
                    )}
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
                        className="bar-rise absolute inset-x-0 bottom-0 bg-gradient-to-t from-sky-600/45 to-sky-600/10"
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
                      <span className="relative z-10 mt-auto pr-3.5 text-[9px] font-bold leading-none text-amber-700 tabular-nums">
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

      {/* TODO：ここから今日のTODOを追加でき、やり残しはその場で完了/削除できる */}
      <UndoneTodos initial={stats.undoneTodos} today={today} />

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
