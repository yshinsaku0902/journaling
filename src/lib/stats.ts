// 走行距離の集計に使う純粋関数。ストア層・カレンダー・統計ページで共用する。
import type { ItemKind } from "./types";

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
