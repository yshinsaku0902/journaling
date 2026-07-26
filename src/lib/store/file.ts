// デモ / ローカル用ストア（DATABASE_URL 未設定時）。
// 単一ユーザー前提で .data/journal.json に丸ごと保存する。
import { promises as fs } from "fs";
import path from "path";
import type { JournalEntry, EntryPatch, OutlookEventInput } from "../types";
import { emptyEntry } from "../types";
import { mergeOutlookEvents, entryHasContent } from "../schedule";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "journal.json");

type DB = Record<string, Record<string, JournalEntry>>; // userId -> date -> entry

async function readDb(): Promise<DB> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as DB;
  } catch {
    return {};
  }
}

async function writeDb(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

// 書き込みの競合を避ける簡易ミューテックス
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function getEntry(
  userId: string,
  date: string,
): Promise<JournalEntry> {
  const db = await readDb();
  return db[userId]?.[date] ?? emptyEntry(date);
}

export async function saveEntry(
  userId: string,
  date: string,
  patch: EntryPatch,
): Promise<JournalEntry> {
  return withLock(async () => {
    const db = await readDb();
    const entry: JournalEntry = {
      date,
      mostImportantGoal: patch.mostImportantGoal,
      dailyQuote: patch.dailyQuote,
      memo: patch.memo,
      items: patch.items,
      schedule: patch.schedule,
      updatedAt: new Date().toISOString(),
    };
    (db[userId] ??= {})[date] = entry;
    await writeDb(db);
    return entry;
  });
}

export async function importOutlook(
  userId: string,
  date: string,
  events: OutlookEventInput[],
): Promise<JournalEntry> {
  return withLock(async () => {
    const db = await readDb();
    const existing = db[userId]?.[date] ?? emptyEntry(date);
    const merged: JournalEntry = {
      ...existing,
      schedule: mergeOutlookEvents(existing.schedule, events),
      updatedAt: new Date().toISOString(),
    };
    (db[userId] ??= {})[date] = merged;
    await writeDb(db);
    return merged;
  });
}

export async function getMonthSummary(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, boolean>> {
  const db = await readDb();
  const user = db[userId] ?? {};
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const out: Record<string, boolean> = {};
  for (const [date, entry] of Object.entries(user)) {
    if (date.startsWith(prefix) && entryHasContent(entry)) out[date] = true;
  }
  return out;
}
