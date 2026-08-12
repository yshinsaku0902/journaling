// デモ / ローカル用ストア（DATABASE_URL 未設定時）。
// 単一ユーザー前提で .data/journal.json に丸ごと保存する。
import { promises as fs } from "fs";
import path from "path";
import type { JournalEntry, EntryPatch, OutlookEventInput } from "../types";
import { emptyEntry } from "../types";
import { mergeOutlookEvents, entryHasContent, newId } from "../schedule";
import { searchInEntry, type SearchResult } from "../search";
import { monthlyKmForYear, type MonthStats } from "../stats";
import type { Challenge, ChallengeInput, ChallengePatch } from "../challenge";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "journal.json");
const GOALS_FILE = path.join(DATA_DIR, "goals.json");
const CHALLENGES_FILE = path.join(DATA_DIR, "challenges.json");

type DB = Record<string, Record<string, JournalEntry>>; // userId -> date -> entry
type GoalDB = Record<string, Record<string, number>>; // userId -> ym -> km
type ChallengeDB = Record<string, Challenge[]>; // userId -> challenges

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

async function readGoals(): Promise<GoalDB> {
  try {
    const raw = await fs.readFile(GOALS_FILE, "utf8");
    return JSON.parse(raw) as GoalDB;
  } catch {
    return {};
  }
}

async function writeGoals(db: GoalDB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(GOALS_FILE, JSON.stringify(db, null, 2), "utf8");
}

async function readChallenges(): Promise<ChallengeDB> {
  try {
    const raw = await fs.readFile(CHALLENGES_FILE, "utf8");
    return JSON.parse(raw) as ChallengeDB;
  } catch {
    return {};
  }
}

async function writeChallenges(db: ChallengeDB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CHALLENGES_FILE, JSON.stringify(db, null, 2), "utf8");
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
  const stored = db[userId]?.[date];
  if (!stored) return emptyEntry(date);
  // 旧データに無い新フィールド（距離・体重）を既定値で補う。
  return { ...emptyEntry(date), ...stored };
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
      runningDistanceKm: patch.runningDistanceKm,
      weightKg: patch.weightKg,
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

export async function getMonthStats(
  userId: string,
  year: number,
  month: number,
): Promise<MonthStats> {
  const db = await readDb();
  const user = db[userId] ?? {};
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const content: Record<string, boolean> = {};
  const distanceByDate: Record<string, number> = {};
  for (const [date, entry] of Object.entries(user)) {
    if (!date.startsWith(prefix)) continue;
    if (entryHasContent(entry)) content[date] = true;
    const km = entry.runningDistanceKm;
    if (typeof km === "number" && km > 0) distanceByDate[date] = km;
  }
  return { content, distanceByDate };
}

export async function getYearDistances(
  userId: string,
  year: number,
): Promise<number[]> {
  const db = await readDb();
  const user = db[userId] ?? {};
  const rows = Object.entries(user).map(([date, entry]) => ({
    date,
    km: entry.runningDistanceKm ?? null,
  }));
  return monthlyKmForYear(rows, year);
}

export async function getMonthlyGoal(
  userId: string,
  ym: string,
): Promise<number | null> {
  const goals = await readGoals();
  const km = goals[userId]?.[ym];
  return typeof km === "number" ? km : null;
}

export async function setMonthlyGoal(
  userId: string,
  ym: string,
  km: number | null,
): Promise<number | null> {
  return withLock(async () => {
    const goals = await readGoals();
    const forUser = (goals[userId] ??= {});
    if (km === null) {
      delete forUser[ym];
    } else {
      forUser[ym] = km;
    }
    await writeGoals(goals);
    return km;
  });
}

export async function searchEntries(
  userId: string,
  query: string,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const db = await readDb();
  const user = db[userId] ?? {};
  const results: SearchResult[] = [];
  for (const [date, entry] of Object.entries(user)) {
    const hits = searchInEntry(entry, q);
    if (hits.length) results.push({ date, hits });
  }
  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}

export async function listChallenges(userId: string): Promise<Challenge[]> {
  const db = await readChallenges();
  return db[userId] ?? [];
}

export async function addChallenge(
  userId: string,
  input: ChallengeInput,
): Promise<Challenge> {
  return withLock(async () => {
    const db = await readChallenges();
    const now = new Date().toISOString();
    const challenge: Challenge = {
      id: newId(),
      text: input.text,
      category: input.category,
      status: "open",
      note: input.note ?? "",
      sourceDate: input.sourceDate ?? null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    (db[userId] ??= []).unshift(challenge);
    await writeChallenges(db);
    return challenge;
  });
}

export async function updateChallenge(
  userId: string,
  id: string,
  patch: ChallengePatch,
): Promise<Challenge | null> {
  return withLock(async () => {
    const db = await readChallenges();
    const list = db[userId];
    const current = list?.find((c) => c.id === id);
    if (!list || !current) return null;

    const nextStatus = patch.status ?? current.status;
    const updated: Challenge = {
      ...current,
      text: patch.text ?? current.text,
      category: patch.category ?? current.category,
      status: nextStatus,
      note: patch.note ?? current.note,
      updatedAt: new Date().toISOString(),
      // 解決に入った時だけ resolvedAt をセット。解決から戻したら消す。
      resolvedAt:
        nextStatus === "resolved"
          ? (current.resolvedAt ?? new Date().toISOString())
          : null,
    };
    db[userId] = list.map((c) => (c.id === id ? updated : c));
    await writeChallenges(db);
    return updated;
  });
}

export async function deleteChallenge(
  userId: string,
  id: string,
): Promise<void> {
  return withLock(async () => {
    const db = await readChallenges();
    const list = db[userId];
    if (!list) return;
    db[userId] = list.filter((c) => c.id !== id);
    await writeChallenges(db);
  });
}
