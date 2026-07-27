// クライアントから受け取った任意の JSON を安全な EntryPatch に整える。
import type {
  EntryPatch,
  JournalItem,
  ScheduleItem,
  AchievementLevel,
} from "./types";
import { newId } from "./schedule";

function str(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function bool(v: unknown): boolean {
  return v === true;
}
function clampInt(v: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof v === "number" ? Math.round(v) : Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// 未記録(null/空)を許容する数値。範囲内にクランプし小数1桁に丸める。
export function nullableNum(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return null;
  const clamped = Math.min(max, Math.max(min, n));
  return Math.round(clamped * 10) / 10;
}

function toItem(v: unknown, idx: number): JournalItem {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    id: str(o.id, 64) || newId(),
    text: str(o.text),
    done: bool(o.done),
    achievement: clampInt(o.achievement, 0, 3, 0) as AchievementLevel,
    sortOrder: typeof o.sortOrder === "number" ? o.sortOrder : idx,
  };
}

function toSchedule(v: unknown): ScheduleItem {
  const o = (v ?? {}) as Record<string, unknown>;
  const source = o.source === "outlook" ? "outlook" : "manual";
  const start = clampInt(o.startMinutes, 0, 24 * 60, 0);
  const endRaw = o.endMinutes;
  const end =
    endRaw === null || endRaw === undefined
      ? null
      : clampInt(endRaw, 0, 24 * 60, start);
  return {
    id: str(o.id, 64) || newId(),
    startMinutes: start,
    endMinutes: end,
    title: str(o.title, 500),
    source,
    outlookEventId:
      typeof o.outlookEventId === "string" ? o.outlookEventId : null,
    resultNote: str(o.resultNote, 1000),
  };
}

export function toEntryPatch(body: unknown): EntryPatch {
  const o = (body ?? {}) as Record<string, unknown>;
  const items = Array.isArray(o.items) ? o.items : [];
  const schedule = Array.isArray(o.schedule) ? o.schedule : [];
  return {
    mostImportantGoal: str(o.mostImportantGoal, 500),
    dailyQuote: str(o.dailyQuote, 500),
    memo: str(o.memo, 4000),
    runningDistanceKm: nullableNum(o.runningDistanceKm, 0, 200),
    weightKg: nullableNum(o.weightKg, 0, 500),
    items: items.slice(0, 200).map(toItem),
    schedule: schedule.slice(0, 200).map(toSchedule),
  };
}
