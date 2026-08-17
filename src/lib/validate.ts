// クライアントから受け取った任意の JSON を安全な EntryPatch に整える。
import type {
  EntryPatch,
  JournalItem,
  ScheduleItem,
  AchievementLevel,
} from "./types";
import type {
  ChallengeCategory,
  ChallengeInput,
  ChallengePatch,
  ChallengeStatus,
} from "./challenge";
import { CHALLENGE_CATEGORIES } from "./challenge";
import { newId } from "./schedule";
import { isValidDateStr } from "./date";

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
    kind: o.kind === "private" ? "private" : "work",
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

const CATEGORY_KEYS = new Set<string>(CHALLENGE_CATEGORIES.map((c) => c.key));
const STATUS_KEYS = new Set<string>(["open", "doing", "resolved"]);

function category(v: unknown): ChallengeCategory {
  return typeof v === "string" && CATEGORY_KEYS.has(v)
    ? (v as ChallengeCategory)
    : "other";
}

// yyyy-MM-dd の妥当な日付のみ許容（それ以外は null）。
function sourceDate(v: unknown): string | null {
  return typeof v === "string" && isValidDateStr(v) ? v : null;
}

// 登録ペイロード。text は呼び出し側(API)で空チェックする前提。
export function toChallengeInput(body: unknown): ChallengeInput {
  const o = (body ?? {}) as Record<string, unknown>;
  return {
    text: str(o.text, 500),
    category: category(o.category),
    note: str(o.note, 1000),
    sourceDate: sourceDate(o.sourceDate),
  };
}

// 部分更新ペイロード。渡されたキーだけを反映する。
export function toChallengePatch(body: unknown): ChallengePatch {
  const o = (body ?? {}) as Record<string, unknown>;
  const patch: ChallengePatch = {};
  if (typeof o.text === "string") patch.text = str(o.text, 500);
  if (typeof o.category === "string") patch.category = category(o.category);
  if (typeof o.status === "string" && STATUS_KEYS.has(o.status)) {
    patch.status = o.status as ChallengeStatus;
  }
  if (typeof o.note === "string") patch.note = str(o.note, 1000);
  return patch;
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
