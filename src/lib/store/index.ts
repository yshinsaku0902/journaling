// ストアのディスパッチ。
// DATABASE_URL があれば Postgres、無ければローカルのファイルストア（デモ）を使う。
import type { JournalEntry, EntryPatch, OutlookEventInput } from "../types";
import type { SearchResult } from "../search";
import type { MonthStats } from "../stats";

export const usePostgres = !!process.env.DATABASE_URL;

type Backend = {
  getEntry(userId: string, date: string): Promise<JournalEntry>;
  saveEntry(
    userId: string,
    date: string,
    patch: EntryPatch,
  ): Promise<JournalEntry>;
  importOutlook(
    userId: string,
    date: string,
    events: OutlookEventInput[],
  ): Promise<JournalEntry>;
  getMonthStats(
    userId: string,
    year: number,
    month: number,
  ): Promise<MonthStats>;
  getYearDistances(userId: string, year: number): Promise<number[]>;
  getMonthlyGoal(userId: string, ym: string): Promise<number | null>;
  setMonthlyGoal(
    userId: string,
    ym: string,
    km: number | null,
  ): Promise<number | null>;
  searchEntries(userId: string, query: string): Promise<SearchResult[]>;
};

async function backend(): Promise<Backend> {
  return usePostgres ? await import("./pg") : await import("./file");
}

export async function getEntry(userId: string, date: string) {
  return (await backend()).getEntry(userId, date);
}
export async function saveEntry(
  userId: string,
  date: string,
  patch: EntryPatch,
) {
  return (await backend()).saveEntry(userId, date, patch);
}
export async function importOutlook(
  userId: string,
  date: string,
  events: OutlookEventInput[],
) {
  return (await backend()).importOutlook(userId, date, events);
}
export async function getMonthStats(
  userId: string,
  year: number,
  month: number,
) {
  return (await backend()).getMonthStats(userId, year, month);
}
export async function getYearDistances(userId: string, year: number) {
  return (await backend()).getYearDistances(userId, year);
}
export async function getMonthlyGoal(userId: string, ym: string) {
  return (await backend()).getMonthlyGoal(userId, ym);
}
export async function setMonthlyGoal(
  userId: string,
  ym: string,
  km: number | null,
) {
  return (await backend()).setMonthlyGoal(userId, ym, km);
}
export async function searchEntries(userId: string, query: string) {
  return (await backend()).searchEntries(userId, query);
}
