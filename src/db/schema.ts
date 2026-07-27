// Drizzle スキーマ（本番: Vercel Postgres / Neon）
// ローカルのデモモード（DATABASE_URL 未設定）ではファイルストアを使うため未使用。
import {
  pgTable,
  serial,
  integer,
  real,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(), // yyyy-MM-dd
    mostImportantGoal: text("most_important_goal").notNull().default(""),
    dailyQuote: text("daily_quote").notNull().default(""),
    memo: text("memo").notNull().default(""),
    runningDistanceKm: real("running_distance_km"), // km（未記録は null）
    weightKg: real("weight_kg"), // kg（未記録は null）
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDate: uniqueIndex("entries_user_date_idx").on(t.userId, t.date),
  }),
);

export const monthlyGoals = pgTable(
  "monthly_goals",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    ym: text("ym").notNull(), // yyyy-MM
    distanceGoalKm: real("distance_goal_km").notNull(), // その月の目標走行距離(km)
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userYm: uniqueIndex("monthly_goals_user_ym_idx").on(t.userId, t.ym),
  }),
);

export const journalItems = pgTable(
  "journal_items",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    text: text("text").notNull().default(""),
    done: boolean("done").notNull().default(false),
    achievement: integer("achievement").notNull().default(0),
  },
  (t) => ({
    byEntry: index("journal_items_entry_idx").on(t.entryId),
  }),
);

export const scheduleItems = pgTable(
  "schedule_items",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id").notNull(),
    startMinutes: integer("start_minutes").notNull(),
    endMinutes: integer("end_minutes"),
    title: text("title").notNull().default(""),
    source: text("source").notNull().default("manual"), // 'outlook' | 'manual'
    outlookEventId: text("outlook_event_id"),
    resultNote: text("result_note").notNull().default(""),
  },
  (t) => ({
    byEntry: index("schedule_items_entry_idx").on(t.entryId),
  }),
);
