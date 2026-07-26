// 日付ユーティリティ（タイムゾーンは Asia/Tokyo 基準）
// 日付は "yyyy-MM-dd" 文字列で扱い、UTC計算でタイムゾーンのズレを避ける。

export const TZ = "Asia/Tokyo";

const WEEKDAYS_JP = ["日", "月", "火", "水", "木", "金", "土"];

// 今日（JST）の yyyy-MM-dd
export function todayJst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function toUTC(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(s: string, n: number): string {
  const dt = toUTC(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

export function weekdayIndex(s: string): number {
  return toUTC(s).getUTCDay();
}

export interface JpDateParts {
  year: number;
  month: number;
  day: number;
  weekday: string; // 日〜土
  weekdayIndex: number;
}

export function jpDateParts(s: string): JpDateParts {
  const [y, m, d] = s.split("-").map(Number);
  const wi = weekdayIndex(s);
  return { year: y, month: m, day: d, weekday: WEEKDAYS_JP[wi], weekdayIndex: wi };
}

// 通年の日数（第○日）
export function dayOfYear(s: string): number {
  const [y] = s.split("-").map(Number);
  const start = Date.UTC(y, 0, 1);
  const cur = toUTC(s).getTime();
  return Math.floor((cur - start) / 86400000) + 1;
}

// ym = "yyyy-MM"
export function parseYm(ym: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const [year, month] = ym.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function ymOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function addMonths(ym: string, n: number): string {
  const p = parseYm(ym);
  if (!p) return ym;
  const dt = new Date(Date.UTC(p.year, p.month - 1 + n, 1));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// 月カレンダーの6週間グリッド（日曜始まり）。各セルは yyyy-MM-dd または null。
export function monthGrid(year: number, month: number): (string | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// 分 → "H:MM"
export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export const WEEKDAY_LABELS = WEEKDAYS_JP;
