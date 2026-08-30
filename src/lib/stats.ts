// 走行距離の集計に使う純粋関数。ストア層・カレンダー・統計ページで共用する。
import type { ItemKind } from "./types";
import { addDays } from "./date";

// トップの「やり残しTODO」1件（未完了＝done:false かつ本文あり）。
export interface UndoneTodo {
  id: string; // その日の記入内のTODO id（完了/削除の対象特定用）
  date: string; // yyyy-MM-dd
  text: string;
  kind: ItemKind; // 仕事 / プライベート
}

// カレンダー1ヶ月分の集計（記入済みフラグと日付ごとの距離）。
export interface MonthStats {
  content: Record<string, boolean>; // 記入済みドット用（date -> true）
  distanceByDate: Record<string, number>; // date -> km（>0 のみ）
  goalByDate: Record<string, string>; // date -> その日の最重点目標（空でない日のみ）
  undoneByDate: Record<string, number>; // date -> 未完了TODO件数（カレンダーのバッジ用）
  undoneTodos: UndoneTodo[]; // 未完了TODO一覧（日付の古い順）
}

// 1年分の月別サマリー（/stats の棒グラフ用）。
export interface YearRunStats {
  km: number[]; // 長さ12。月別の合計距離
  runDays: number[]; // 長さ12。月別の走った日数
}

// 小数1桁に丸める（浮動小数の誤差を抑える）。
export function roundKm(n: number): number {
  return Math.round(n * 10) / 10;
}

// null/undefined を無視して合計し、小数1桁に丸める。
export function sumKm(values: (number | null | undefined)[]): number {
  let total = 0;
  for (const v of values) {
    if (typeof v === "number" && !Number.isNaN(v)) total += v;
  }
  return roundKm(total);
}

// 走った日のまとめ（トップの「今月何回走ったか」とご褒美演出に使う）。
export interface RunSummary {
  runDates: string[]; // 昇順。走った日（km > 0）
  runCount: number; // 今月走った回数
  avgKm: number; // ラン日あたり平均距離（⭐判定の基準）
  bestDate: string | null; // その月の最長距離の日（同点は早い日）
  bestKm: number;
  streak: number; // 連続ラン日数
  streakIsCurrent: boolean; // true=継続中の連続 / false=その月の最長連続
}

// 走った日の集計。distanceByDate はその月のぶんだけなので、
// 月をまたぐ連続日数は数えない（月初で途切れて見える）。
export function summarizeRuns(
  distanceByDate: Record<string, number>,
  today: string,
  isCurrentMonth: boolean,
): RunSummary {
  const runDates = Object.keys(distanceByDate).sort();
  const runCount = runDates.length;
  if (runCount === 0) {
    return {
      runDates,
      runCount: 0,
      avgKm: 0,
      bestDate: null,
      bestKm: 0,
      streak: 0,
      streakIsCurrent: false,
    };
  }

  const total = sumKm(runDates.map((d) => distanceByDate[d]));
  let bestDate = runDates[0];
  for (const d of runDates) {
    if (distanceByDate[d] > distanceByDate[bestDate]) bestDate = d;
  }

  const ran = (d: string) => distanceByDate[d] != null;
  // 起点から前日へ遡って連続日数を数える。
  const streakBackFrom = (start: string): number => {
    let n = 0;
    let cur = start;
    while (ran(cur)) {
      n++;
      cur = addDays(cur, -1);
    }
    return n;
  };

  // 当月は「今日（今日が未ランなら昨日）から続いている連続」を優先して見せる。
  if (isCurrentMonth) {
    const anchor = ran(today) ? today : addDays(today, -1);
    const current = streakBackFrom(anchor);
    if (current > 0) {
      return {
        runDates,
        runCount,
        avgKm: roundKm(total / runCount),
        bestDate,
        bestKm: distanceByDate[bestDate],
        streak: current,
        streakIsCurrent: true,
      };
    }
  }

  // 継続していない（過去月・途切れている）ときは月内の最長連続。
  let longest = 0;
  for (const d of runDates) {
    if (ran(addDays(d, -1))) continue; // 連続の先頭だけを起点に数える
    let n = 0;
    let cur = d;
    while (ran(cur)) {
      n++;
      cur = addDays(cur, 1);
    }
    longest = Math.max(longest, n);
  }

  return {
    runDates,
    runCount,
    avgKm: roundKm(total / runCount),
    bestDate,
    bestKm: distanceByDate[bestDate],
    streak: longest,
    streakIsCurrent: false,
  };
}

// 1年分の (date, km) 行から、月別(1〜12月)の合計距離の配列[12]を作る。
export function monthlyKmForYear(
  rows: { date: string; km: number | null }[],
  year: number,
): number[] {
  const totals = new Array(12).fill(0) as number[];
  const prefix = `${year}-`;
  for (const r of rows) {
    if (!r.date.startsWith(prefix) || typeof r.km !== "number") continue;
    const month = Number(r.date.slice(5, 7)); // 1..12
    if (month >= 1 && month <= 12) totals[month - 1] += r.km;
  }
  return totals.map(roundKm);
}

// 1年分の (date, km) 行から、月別(1〜12月)の「走った日数」の配列[12]を作る。
export function monthlyRunDaysForYear(
  rows: { date: string; km: number | null }[],
  year: number,
): number[] {
  const counts = new Array(12).fill(0) as number[];
  const prefix = `${year}-`;
  for (const r of rows) {
    if (!r.date.startsWith(prefix)) continue;
    if (typeof r.km !== "number" || r.km <= 0) continue;
    const month = Number(r.date.slice(5, 7)); // 1..12
    if (month >= 1 && month <= 12) counts[month - 1] += 1;
  }
  return counts;
}
