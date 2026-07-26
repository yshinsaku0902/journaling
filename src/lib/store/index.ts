// ストアのディスパッチ。
// DATABASE_URL があれば Postgres、無ければローカルのファイルストア（デモ）を使う。
import type { JournalEntry, EntryPatch, OutlookEventInput } from "../types";
import type { SearchResult } from "../search";

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
  getMonthSummary(
    userId: string,
    year: number,
    month: number,
  ): Promise<Record<string, boolean>>;
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
export async function getMonthSummary(
  userId: string,
  year: number,
  month: number,
) {
  return (await backend()).getMonthSummary(userId, year, month);
}
export async function searchEntries(userId: string, query: string) {
  return (await backend()).searchEntries(userId, query);
}
