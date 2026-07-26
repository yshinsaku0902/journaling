import type {
  JournalEntry,
  ScheduleItem,
  OutlookEventInput,
} from "./types";

export const newId = (): string => globalThis.crypto.randomUUID();

// 既存の時間軸に Outlook イベントをマージする。
// - 手動追加(source=manual)はそのまま保持
// - 既存の Outlook 予定の「結果」欄は、同じ outlookEventId であれば引き継ぐ
// - Outlook から消えた予定は取り除く
export function mergeOutlookEvents(
  existing: ScheduleItem[],
  events: OutlookEventInput[],
): ScheduleItem[] {
  const manual = existing.filter((s) => s.source === "manual");
  const prevOutlook = new Map(
    existing
      .filter((s) => s.source === "outlook" && s.outlookEventId)
      .map((s) => [s.outlookEventId as string, s]),
  );

  const nextOutlook: ScheduleItem[] = events.map((ev) => {
    const prev = prevOutlook.get(ev.outlookEventId);
    return {
      id: prev?.id ?? newId(),
      startMinutes: ev.startMinutes,
      endMinutes: ev.endMinutes,
      title: ev.title,
      source: "outlook",
      outlookEventId: ev.outlookEventId,
      resultNote: prev?.resultNote ?? "",
    };
  });

  return [...nextOutlook, ...manual].sort(
    (a, b) => a.startMinutes - b.startMinutes,
  );
}

// カレンダーの「記入済み」ドット判定
export function entryHasContent(e: JournalEntry): boolean {
  if (e.mostImportantGoal.trim() || e.memo.trim() || e.dailyQuote.trim()) {
    return true;
  }
  if (e.items.some((i) => i.text.trim())) return true;
  return e.schedule.some((s) =>
    s.source === "manual"
      ? s.title.trim() || s.resultNote.trim()
      : s.resultNote.trim(),
  );
}
