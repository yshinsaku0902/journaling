// 本番用ストア（Vercel Postgres / Neon）。DATABASE_URL 設定時に使用。
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, inArray, like, or, ilike, desc } from "drizzle-orm";
import {
  entries,
  journalItems,
  scheduleItems,
  monthlyGoals,
  challenges,
} from "@/db/schema";
import type {
  JournalEntry,
  EntryPatch,
  OutlookEventInput,
  AchievementLevel,
} from "../types";
import { emptyEntry } from "../types";
import { mergeOutlookEvents } from "../schedule";
import { searchInEntry, type SearchResult } from "../search";
import { monthlyKmForYear, type MonthStats } from "../stats";
import type {
  Challenge,
  ChallengeCategory,
  ChallengeInput,
  ChallengePatch,
  ChallengeStatus,
} from "../challenge";

type DrizzleDb = ReturnType<typeof drizzle>;
let _db: DrizzleDb | null = null;

function db(): DrizzleDb {
  if (!_db) {
    const client = postgres(process.env.DATABASE_URL as string, {
      prepare: false,
    });
    _db = drizzle(client);
  }
  return _db;
}

export async function getEntry(
  userId: string,
  date: string,
): Promise<JournalEntry> {
  const d = db();
  const [e] = await d
    .select()
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.date, date)))
    .limit(1);
  if (!e) return emptyEntry(date);

  const items = await d
    .select()
    .from(journalItems)
    .where(eq(journalItems.entryId, e.id))
    .orderBy(journalItems.sortOrder);
  const sched = await d
    .select()
    .from(scheduleItems)
    .where(eq(scheduleItems.entryId, e.id))
    .orderBy(scheduleItems.startMinutes);

  return {
    date,
    mostImportantGoal: e.mostImportantGoal,
    dailyQuote: e.dailyQuote,
    memo: e.memo,
    runningDistanceKm: e.runningDistanceKm,
    weightKg: e.weightKg,
    items: items.map((i) => ({
      id: String(i.id),
      text: i.text,
      done: i.done,
      achievement: i.achievement as AchievementLevel,
      sortOrder: i.sortOrder,
    })),
    schedule: sched.map((s) => ({
      id: String(s.id),
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      title: s.title,
      source: s.source as "outlook" | "manual",
      outlookEventId: s.outlookEventId,
      resultNote: s.resultNote,
    })),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function saveEntry(
  userId: string,
  date: string,
  patch: EntryPatch,
): Promise<JournalEntry> {
  const d = db();
  const now = new Date();
  const [row] = await d
    .insert(entries)
    .values({
      userId,
      date,
      mostImportantGoal: patch.mostImportantGoal,
      dailyQuote: patch.dailyQuote,
      memo: patch.memo,
      runningDistanceKm: patch.runningDistanceKm,
      weightKg: patch.weightKg,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [entries.userId, entries.date],
      set: {
        mostImportantGoal: patch.mostImportantGoal,
        dailyQuote: patch.dailyQuote,
        memo: patch.memo,
        runningDistanceKm: patch.runningDistanceKm,
        weightKg: patch.weightKg,
        updatedAt: now,
      },
    })
    .returning();

  const entryId = row.id;

  await d.delete(journalItems).where(eq(journalItems.entryId, entryId));
  if (patch.items.length) {
    await d.insert(journalItems).values(
      patch.items.map((it, idx) => ({
        entryId,
        sortOrder: it.sortOrder ?? idx,
        text: it.text,
        done: it.done,
        achievement: it.achievement,
      })),
    );
  }

  await d.delete(scheduleItems).where(eq(scheduleItems.entryId, entryId));
  if (patch.schedule.length) {
    await d.insert(scheduleItems).values(
      patch.schedule.map((s) => ({
        entryId,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        title: s.title,
        source: s.source,
        outlookEventId: s.outlookEventId,
        resultNote: s.resultNote,
      })),
    );
  }

  return { date, ...patch, updatedAt: now.toISOString() };
}

export async function importOutlook(
  userId: string,
  date: string,
  events: OutlookEventInput[],
): Promise<JournalEntry> {
  const existing = await getEntry(userId, date);
  const schedule = mergeOutlookEvents(existing.schedule, events);
  return saveEntry(userId, date, {
    mostImportantGoal: existing.mostImportantGoal,
    dailyQuote: existing.dailyQuote,
    memo: existing.memo,
    runningDistanceKm: existing.runningDistanceKm,
    weightKg: existing.weightKg,
    items: existing.items,
    schedule,
  });
}

export async function getMonthStats(
  userId: string,
  year: number,
  month: number,
): Promise<MonthStats> {
  const d = db();
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const es = await d
    .select()
    .from(entries)
    .where(and(eq(entries.userId, userId), like(entries.date, `${prefix}%`)));
  if (!es.length) return { content: {}, distanceByDate: {}, goalByDate: {} };

  const ids = es.map((e) => e.id);
  const byId = new Map(es.map((e) => [e.id, e]));
  const its = await d
    .select()
    .from(journalItems)
    .where(inArray(journalItems.entryId, ids));
  const scs = await d
    .select()
    .from(scheduleItems)
    .where(inArray(scheduleItems.entryId, ids));

  const content: Record<string, boolean> = {};
  const distanceByDate: Record<string, number> = {};
  const goalByDate: Record<string, string> = {};
  for (const e of es) {
    if (e.mostImportantGoal.trim() || e.memo.trim() || e.dailyQuote.trim()) {
      content[e.date] = true;
    }
    if (typeof e.runningDistanceKm === "number" && e.runningDistanceKm > 0) {
      distanceByDate[e.date] = e.runningDistanceKm;
    }
    if (e.mostImportantGoal.trim()) {
      goalByDate[e.date] = e.mostImportantGoal.trim();
    }
  }
  for (const it of its) {
    if (it.text.trim()) {
      const e = byId.get(it.entryId);
      if (e) content[e.date] = true;
    }
  }
  for (const s of scs) {
    const has =
      s.source === "manual"
        ? s.title.trim() || s.resultNote.trim()
        : s.resultNote.trim();
    if (has) {
      const e = byId.get(s.entryId);
      if (e) content[e.date] = true;
    }
  }
  return { content, distanceByDate, goalByDate };
}

export async function getYearDistances(
  userId: string,
  year: number,
): Promise<number[]> {
  const d = db();
  const rows = await d
    .select({ date: entries.date, km: entries.runningDistanceKm })
    .from(entries)
    .where(and(eq(entries.userId, userId), like(entries.date, `${year}-%`)));
  return monthlyKmForYear(rows, year);
}

export async function getMonthlyGoal(
  userId: string,
  ym: string,
): Promise<number | null> {
  const d = db();
  const [row] = await d
    .select()
    .from(monthlyGoals)
    .where(and(eq(monthlyGoals.userId, userId), eq(monthlyGoals.ym, ym)))
    .limit(1);
  return row ? row.distanceGoalKm : null;
}

export async function setMonthlyGoal(
  userId: string,
  ym: string,
  km: number | null,
): Promise<number | null> {
  const d = db();
  if (km === null) {
    await d
      .delete(monthlyGoals)
      .where(and(eq(monthlyGoals.userId, userId), eq(monthlyGoals.ym, ym)));
    return null;
  }
  await d
    .insert(monthlyGoals)
    .values({ userId, ym, distanceGoalKm: km, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [monthlyGoals.userId, monthlyGoals.ym],
      set: { distanceGoalKm: km, updatedAt: new Date() },
    });
  return km;
}

// LIKE のワイルドカード（% _ \）をエスケープして部分一致パターンにする。
function likePattern(query: string): string {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

export async function searchEntries(
  userId: string,
  query: string,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const d = db();
  const pat = likePattern(q);
  const es = await d
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        or(
          ilike(entries.mostImportantGoal, pat),
          ilike(entries.dailyQuote, pat),
          ilike(entries.memo, pat),
        ),
      ),
    )
    .orderBy(desc(entries.date));

  const results: SearchResult[] = [];
  for (const e of es) {
    // 検索対象は自由記述の3列のみなので items/schedule は空で十分。
    const entry: JournalEntry = {
      date: e.date,
      mostImportantGoal: e.mostImportantGoal,
      dailyQuote: e.dailyQuote,
      memo: e.memo,
      runningDistanceKm: e.runningDistanceKm,
      weightKg: e.weightKg,
      items: [],
      schedule: [],
      updatedAt: e.updatedAt.toISOString(),
    };
    const hits = searchInEntry(entry, q);
    if (hits.length) results.push({ date: e.date, hits });
  }
  return results;
}

// challenges テーブルの行をドメイン型に変換する。
function rowToChallenge(r: typeof challenges.$inferSelect): Challenge {
  return {
    id: String(r.id),
    text: r.text,
    category: r.category as ChallengeCategory,
    status: r.status as ChallengeStatus,
    note: r.note,
    sourceDate: r.sourceDate,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  };
}

export async function listChallenges(userId: string): Promise<Challenge[]> {
  const d = db();
  const rows = await d
    .select()
    .from(challenges)
    .where(eq(challenges.userId, userId))
    .orderBy(desc(challenges.createdAt));
  return rows.map(rowToChallenge);
}

export async function addChallenge(
  userId: string,
  input: ChallengeInput,
): Promise<Challenge> {
  const d = db();
  const now = new Date();
  const [row] = await d
    .insert(challenges)
    .values({
      userId,
      text: input.text,
      category: input.category,
      status: "open",
      note: input.note ?? "",
      sourceDate: input.sourceDate ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rowToChallenge(row);
}

export async function updateChallenge(
  userId: string,
  id: string,
  patch: ChallengePatch,
): Promise<Challenge | null> {
  const numId = Number(id);
  if (!Number.isInteger(numId)) return null;
  const d = db();

  const [current] = await d
    .select()
    .from(challenges)
    .where(and(eq(challenges.userId, userId), eq(challenges.id, numId)))
    .limit(1);
  if (!current) return null;

  const now = new Date();
  const nextStatus = (patch.status ?? current.status) as ChallengeStatus;
  const [row] = await d
    .update(challenges)
    .set({
      text: patch.text ?? current.text,
      category: patch.category ?? current.category,
      status: nextStatus,
      note: patch.note ?? current.note,
      updatedAt: now,
      // 解決に入った時だけ resolvedAt をセット。解決から戻したら消す。
      resolvedAt:
        nextStatus === "resolved" ? (current.resolvedAt ?? now) : null,
    })
    .where(and(eq(challenges.userId, userId), eq(challenges.id, numId)))
    .returning();
  return row ? rowToChallenge(row) : null;
}

export async function deleteChallenge(
  userId: string,
  id: string,
): Promise<void> {
  const numId = Number(id);
  if (!Number.isInteger(numId)) return;
  const d = db();
  await d
    .delete(challenges)
    .where(and(eq(challenges.userId, userId), eq(challenges.id, numId)));
}
