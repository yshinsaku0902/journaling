// アプリ全体で共有するドメイン型

// 達成度合: 0=未設定 / 1=△ / 2=○ / 3=◎
export type AchievementLevel = 0 | 1 | 2 | 3;

export const ACHIEVEMENT_LABELS: Record<AchievementLevel, string> = {
  0: "—",
  1: "△",
  2: "○",
  3: "◎",
};

// 左ページ・メイン記入欄の1行（箇条書き＋達成度合）
export interface JournalItem {
  id: string;
  text: string;
  done: boolean;
  achievement: AchievementLevel;
  sortOrder: number;
}

// 右ページ・時間軸の1件（行動予定／結果）
export interface ScheduleItem {
  id: string;
  startMinutes: number; // 0:00 からの分（例: 7:30 => 450）
  endMinutes: number | null;
  title: string;
  source: "outlook" | "manual";
  outlookEventId: string | null;
  resultNote: string; // 「結果」欄
}

// 1日分のジャーナル（手帳の見開き1日分）
export interface JournalEntry {
  date: string; // yyyy-MM-dd
  mostImportantGoal: string; // 今日の最重点目標
  dailyQuote: string; // 名言（任意）
  memo: string; // MEMO
  runningDistanceKm: number | null; // 当日のランニング距離（km・未記録は null）
  weightKg: number | null; // 当日の体重（kg・未記録は null）
  items: JournalItem[]; // メイン記入欄
  schedule: ScheduleItem[]; // 時間軸
  updatedAt: string; // ISO
}

// クライアントから保存時に送るペイロード（date/updatedAt を除く）
export type EntryPatch = Pick<
  JournalEntry,
  | "mostImportantGoal"
  | "dailyQuote"
  | "memo"
  | "runningDistanceKm"
  | "weightKg"
  | "items"
  | "schedule"
>;

// Outlook(Graph) から取り込むイベントの入力形
export interface OutlookEventInput {
  outlookEventId: string;
  title: string;
  startMinutes: number;
  endMinutes: number | null;
}

export function emptyEntry(date: string): JournalEntry {
  return {
    date,
    mostImportantGoal: "",
    dailyQuote: "",
    memo: "",
    runningDistanceKm: null,
    weightKg: null,
    items: [],
    schedule: [],
    updatedAt: new Date().toISOString(),
  };
}
