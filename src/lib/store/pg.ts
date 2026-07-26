// 本番用ストア（Vercel Postgres / Neon）。DATABASE_URL 設定時に使用。
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, inArray, like } from "drizzle-orm";
import { entries, journalItems, scheduleItems } from "@/db/schema";
import type {
  JournalEntry,
  EntryPatch,
  OutlookEventInput,
  AchievementLevel,
} from "../types";
import { emptyEntry } from "../types";
import { mergeOutlookEvents } from "../schedule";

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
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [entries.userId, entries.date],
      set: {
        mostImportantGoal: patch.mostImportantGoal,
        dailyQuote: patch.dailyQuote,
        memo: patch.memo,
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
    items: existing.items,
    schedule,
  });
}

export async function getMonthSummary(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, boolean>> {
  const d = db();
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const es = await d
    .select()
    .from(entries)
    .where(and(eq(entries.userId, userId), like(entries.date, `${prefix}%`)));
  if (!es.length) return {};

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

  const out: Record<string, boolean> = {};
  for (const e of es) {
    if (e.mostImportantGoal.trim() || e.memo.trim() || e.dailyQuote.trim()) {
      out[e.date] = true;
    }
  }
  for (const it of its) {
    if (it.text.trim()) {
      const e = byId.get(it.entryId);
      if (e) out[e.date] = true;
    }
  }
  for (const s of scs) {
    const content =
      s.source === "manual"
        ? s.title.trim() || s.resultNote.trim()
        : s.resultNote.trim();
    if (content) {
      const e = byId.get(s.entryId);
      if (e) out[e.date] = true;
    }
  }
  return out;
}
