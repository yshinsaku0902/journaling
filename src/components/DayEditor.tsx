"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  JournalEntry,
  JournalItem,
  ScheduleItem,
  EntryPatch,
} from "@/lib/types";
import { ITEM_KINDS, itemKindMeta } from "@/lib/types";
import type { JpDateParts } from "@/lib/date";
import { minutesToLabel } from "@/lib/date";
import { ChallengeQuickAdd } from "@/components/ChallengeQuickAdd";

interface Props {
  date: string;
  initialEntry: JournalEntry;
  prevDate: string;
  nextDate: string;
  isToday: boolean;
  dayNumber: number;
  parts: JpDateParts;
  demoMode: boolean;
}

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const HOURS = Array.from({ length: 20 }, (_, i) => 5 + i); // 5:00〜24:00
const HOUR_MIN = HOURS[0]; // 5
const HOUR_MAX = HOURS[HOURS.length - 1]; // 24
const LANE_STEP = 7; // px: 時間またぎ帯の横方向の間隔
const BAR_WIDTH = 4; // px: 帯の太さ

// 右ページの「行動予定」で、時間をまたぐ予定を縦帯として可視化するためのデータ。
interface SpanBar {
  id: string;
  lane: number; // 同時間帯に並ぶ場合の横位置
  startHour: number; // 帯の先頭（この時間の行で上端を丸める）
  endHour: number; // 帯の末尾（この時間の行で下端を丸める）
  color: string;
  label: string; // ホバー時のツールチップ
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function minutesToHhmm(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (m || 0);
}
const newId = () => globalThis.crypto.randomUUID();

// 数値フィールド（距離・体重）と入力欄の文字列の相互変換
function numToInput(n: number | null): string {
  return n == null ? "" : String(n);
}
function inputToNum(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

export function DayEditor(props: Props) {
  const { date, initialEntry, prevDate, nextDate, isToday, dayNumber, parts } =
    props;

  const [goal, setGoal] = useState(initialEntry.mostImportantGoal);
  const [quote, setQuote] = useState(initialEntry.dailyQuote);
  const [memo, setMemo] = useState(initialEntry.memo);
  const [distance, setDistance] = useState(
    numToInput(initialEntry.runningDistanceKm),
  );
  const [weight, setWeight] = useState(numToInput(initialEntry.weightKg));
  const [items, setItems] = useState<JournalItem[]>(initialEntry.items);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(
    initialEntry.schedule,
  );

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [importing, setImporting] = useState(false);

  const firstRender = useRef(true);

  // ---- 保存（自動保存） ----
  async function doSave() {
    setSaveState("saving");
    try {
      const patch: EntryPatch = {
        mostImportantGoal: goal,
        dailyQuote: quote,
        memo,
        runningDistanceKm: inputToNum(distance),
        weightKg: inputToNum(weight),
        items,
        schedule,
      };
      const res = await fetch(`/api/entry/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("saved");
      setSavedAt(new Date());
    } catch {
      setSaveState("error");
    }
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("pending");
    const t = setTimeout(() => {
      void doSave();
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, quote, memo, distance, weight, items, schedule]);

  // ---- Outlook 取り込み ----
  async function handleImport(auto = false) {
    if (importing) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/entry/${date}/import`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (!auto) alert(data?.message ?? "予定の取り込みに失敗しました。");
        return;
      }
      setSchedule(data.entry.schedule as ScheduleItem[]);
    } catch {
      if (!auto) alert("予定の取り込みに失敗しました。");
    } finally {
      setImporting(false);
    }
  }

  // 当日を初めて開いたとき、Outlook予定が無ければ自動取り込み
  useEffect(() => {
    const hasOutlook = initialEntry.schedule.some((s) => s.source === "outlook");
    if (isToday && !hasOutlook) {
      void handleImport(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- items 操作 ----
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      {
        id: newId(),
        text: "",
        done: false,
        achievement: 0,
        kind: "work",
        sortOrder: prev.length,
      },
    ]);
  const updateItem = (id: string, patch: Partial<JournalItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const deleteItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));
  const toggleKind = (id: string) =>
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, kind: i.kind === "work" ? "private" : "work" }
          : i,
      ),
    );

  // ---- schedule 操作 ----
  const addManualAt = (hour: number) =>
    setSchedule((prev) => [
      ...prev,
      {
        id: newId(),
        startMinutes: hour * 60,
        endMinutes: null,
        title: "",
        source: "manual",
        outlookEventId: null,
        resultNote: "",
      },
    ]);
  const updateSchedule = (id: string, patch: Partial<ScheduleItem>) =>
    setSchedule((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  const deleteSchedule = (id: string) =>
    setSchedule((prev) => prev.filter((s) => s.id !== id));

  const scheduleByHour = useMemo(() => {
    const map = new Map<number, ScheduleItem[]>();
    for (const s of [...schedule].sort(
      (a, b) => a.startMinutes - b.startMinutes,
    )) {
      const h = Math.max(5, Math.min(24, Math.floor(s.startMinutes / 60)));
      const arr = map.get(h);
      if (arr) arr.push(s);
      else map.set(h, [s]);
    }
    return map;
  }, [schedule]);

  // 時間をまたぐ予定（例: 14:00〜16:00）を各時間の行に縦帯として描画するための情報。
  // 終了時刻があり、かつ複数の時間にまたがる予定だけを対象にする。
  const { barsByHour, laneCount } = useMemo(() => {
    const spans = schedule
      .filter(
        (s): s is ScheduleItem & { endMinutes: number } =>
          s.endMinutes != null && s.endMinutes > s.startMinutes,
      )
      .map((s) => ({
        item: s,
        start: s.startMinutes,
        end: s.endMinutes,
        firstHour: Math.floor(s.startMinutes / 60),
        lastHour: Math.ceil(s.endMinutes / 60) - 1, // 予定が触れる最後の時間
      }))
      .filter((s) => s.lastHour > s.firstHour) // 時間の境界を1つ以上またぐものだけ
      .sort((a, b) => a.start - b.start || a.end - b.end);

    // 同時に走る予定が横に重ならないよう、貪欲法でレーンを割り当てる。
    const laneEnds: number[] = []; // 各レーンで最後に埋まっている終了分
    const map = new Map<number, SpanBar[]>();
    for (const s of spans) {
      let lane = laneEnds.findIndex((e) => e <= s.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(s.end);
      } else {
        laneEnds[lane] = s.end;
      }
      const startHour = Math.max(HOUR_MIN, s.firstHour);
      const endHour = Math.min(HOUR_MAX, s.lastHour);
      if (endHour < startHour) continue;
      const color = s.item.source === "outlook" ? "#243b53" : "#b91c1c";
      const label = `${s.item.title || "予定"}（${minutesToLabel(
        s.start,
      )}〜${minutesToLabel(s.end)}）`;
      for (let h = startHour; h <= endHour; h++) {
        const seg: SpanBar = { id: s.item.id, lane, startHour, endHour, color, label };
        const arr = map.get(h);
        if (arr) arr.push(seg);
        else map.set(h, [seg]);
      }
    }
    return { barsByHour: map, laneCount: laneEnds.length };
  }, [schedule]);

  const weekdayColor =
    parts.weekdayIndex === 0
      ? "text-accent"
      : parts.weekdayIndex === 6
        ? "text-blue-600"
        : "text-ink";

  return (
    <main className="mx-auto max-w-4xl px-3 py-4 pb-28">
      {/* ヘッダー */}
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="text-sm text-gray-600 hover:text-navy flex items-center gap-1"
        >
          ← カレンダー
        </Link>
        <SaveIndicator state={saveState} savedAt={savedAt} />
      </header>

      <div className="mt-3 flex items-end justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/journal/${prevDate}`}
            className="px-2 py-1 rounded-lg hover:bg-gray-100 text-gray-500 text-lg"
            aria-label="前日"
          >
            ‹
          </Link>
          <div>
            <div className={`text-3xl font-bold ${weekdayColor}`}>
              {parts.month}/{parts.day}
              <span className="text-xl ml-1">（{parts.weekday}）</span>
              {isToday && (
                <span className="ml-2 align-middle text-xs bg-navy text-white rounded-full px-2 py-0.5">
                  今日
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {parts.year}年 第{dayNumber}日
            </div>
          </div>
          <Link
            href={`/journal/${nextDate}`}
            className="px-2 py-1 rounded-lg hover:bg-gray-100 text-gray-500 text-lg"
            aria-label="翌日"
          >
            ›
          </Link>
        </div>
        {!isToday && (
          <Link
            href="/journal/today"
            className="text-xs text-navy underline underline-offset-2"
          >
            今日へ
          </Link>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* ===== 左ページ：振り返り・目標 ===== */}
        <section className="bg-white rounded-2xl shadow-sm border border-rule p-4">
          {/* 健康記録（ランニング距離・体重） */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                ランニング距離
              </label>
              <div className="mt-1 flex items-baseline gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="0.0"
                  className="w-full rounded-lg border border-rule focus:border-navy bg-transparent px-3 py-2 text-lg font-bold tabular-nums outline-none transition"
                />
                <span className="shrink-0 text-xs text-gray-400">km</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                体重
              </label>
              <div className="mt-1 flex items-baseline gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.0"
                  className="w-full rounded-lg border border-rule focus:border-navy bg-transparent px-3 py-2 text-lg font-bold tabular-nums outline-none transition"
                />
                <span className="shrink-0 text-xs text-gray-400">kg</span>
              </div>
            </div>
          </div>

          <label className="mt-5 block text-xs font-medium text-gray-500">
            今日の最重点目標
          </label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="今日いちばん大切にすること"
            className="mt-1 w-full rounded-lg border-2 border-accent/40 focus:border-accent bg-accent/5 px-3 py-2 font-bold text-lg outline-none transition"
          />

          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy">TODO</h3>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              {ITEM_KINDS.map((k) => (
                <span key={k.key} className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: k.color }}
                  />
                  {k.label}
                </span>
              ))}
            </div>
          </div>
          <ul className="mt-2 space-y-1.5">
            {items.map((item) => {
              const kindMeta = itemKindMeta(item.kind);
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-md py-0.5 pl-2"
                  style={{ borderLeft: `3px solid ${kindMeta.color}` }}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) =>
                      updateItem(item.id, { done: e.target.checked })
                    }
                    className="h-5 w-5 shrink-0 cursor-pointer rounded"
                    style={{ accentColor: kindMeta.color }}
                    aria-label="完了"
                  />
                  <input
                    value={item.text}
                    onChange={(e) =>
                      updateItem(item.id, { text: e.target.value })
                    }
                    placeholder="やること・TODO"
                    className={`field-line flex-1 ${
                      item.done ? "text-gray-400 line-through" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => toggleKind(item.id)}
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white transition hover:opacity-85"
                    style={{ backgroundColor: kindMeta.color }}
                    title="仕事／プライベートを切替"
                  >
                    {kindMeta.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="shrink-0 px-1 text-gray-300 hover:text-accent"
                    aria-label="削除"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={addItem}
            className="mt-2 text-sm text-navy hover:underline"
          >
            ＋ TODOを追加
          </button>

          <div className="mt-6">
            <label className="block text-xs font-medium text-gray-500">
              MEMO
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={18}
              placeholder="メモ・自由記入"
              className="mt-1 min-h-[20rem] w-full rounded-lg border border-rule focus:border-navy bg-transparent px-3 py-2 outline-none transition"
            />
          </div>

          <ChallengeQuickAdd date={date} />
        </section>

        {/* ===== 右ページ：時間軸 ===== */}
        <section className="bg-white rounded-2xl shadow-sm border border-rule p-4">
          <input
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="今日の名言（任意）"
            className="w-full bg-transparent outline-none text-sm italic text-gray-500 border-b border-dashed border-rule pb-1"
          />

          <div className="mt-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy">行動予定</h3>
            <button
              type="button"
              onClick={() => handleImport(false)}
              disabled={importing}
              className="text-xs rounded-lg border border-navy text-navy px-3 py-1.5 hover:bg-navy/5 disabled:opacity-50 transition"
            >
              {importing ? "取り込み中…" : "Outlook予定を取り込む"}
            </button>
          </div>

          <div className="mt-3 divide-y divide-rule">
            {HOURS.map((hour) => {
              const rows = scheduleByHour.get(hour) ?? [];
              const bars = barsByHour.get(hour) ?? [];
              return (
                <div key={hour} className="flex gap-2 min-h-[2.75rem]">
                  <div className="w-8 shrink-0 pt-1.5 text-right text-xs text-gray-400 tabular-nums">
                    {hour}
                  </div>
                  {laneCount > 0 && (
                    <div
                      className="relative shrink-0 self-stretch"
                      style={{ width: laneCount * LANE_STEP }}
                      aria-hidden
                    >
                      {bars.map((seg) => (
                        <div
                          key={seg.id}
                          className="absolute inset-y-0"
                          title={seg.label}
                          style={{
                            left: seg.lane * LANE_STEP,
                            width: BAR_WIDTH,
                            background: seg.color,
                            opacity: 0.85,
                            borderTopLeftRadius: hour === seg.startHour ? 3 : 0,
                            borderTopRightRadius: hour === seg.startHour ? 3 : 0,
                            borderBottomLeftRadius: hour === seg.endHour ? 3 : 0,
                            borderBottomRightRadius: hour === seg.endHour ? 3 : 0,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex-1 py-1.5 space-y-1.5">
                    {rows.map((s) => (
                      <ScheduleRow
                        key={s.id}
                        item={s}
                        onChange={(patch) => updateSchedule(s.id, patch)}
                        onDelete={() => deleteSchedule(s.id)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => addManualAt(hour)}
                      className="text-[11px] text-gray-300 hover:text-navy"
                    >
                      ＋ 予定
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <p className="mt-6 text-center text-[11px] text-gray-400">
        お金の管理は今後のアップデートで追加予定です。
      </p>
    </main>
  );
}

function ScheduleRow({
  item,
  onChange,
  onDelete,
}: {
  item: ScheduleItem;
  onChange: (patch: Partial<ScheduleItem>) => void;
  onDelete: () => void;
}) {
  const isOutlook = item.source === "outlook";
  return (
    <div
      className={`rounded-lg px-2 py-1.5 ${
        isOutlook ? "bg-navy/5 border border-navy/10" : "bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2">
        {isOutlook ? (
          <span className="text-xs font-medium text-navy tabular-nums shrink-0">
            {minutesToLabel(item.startMinutes)}
            {item.endMinutes != null && `–${minutesToLabel(item.endMinutes)}`}
          </span>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="time"
              value={minutesToHhmm(item.startMinutes)}
              onChange={(e) =>
                onChange({ startMinutes: hhmmToMinutes(e.target.value) })
              }
              className="text-xs border border-rule rounded px-1 py-0.5"
            />
            <span className="text-gray-300 text-xs" aria-hidden>
              –
            </span>
            <input
              type="time"
              value={
                item.endMinutes != null ? minutesToHhmm(item.endMinutes) : ""
              }
              onChange={(e) =>
                onChange({
                  endMinutes: e.target.value
                    ? hhmmToMinutes(e.target.value)
                    : null,
                })
              }
              aria-label="終了時刻"
              className="text-xs border border-rule rounded px-1 py-0.5 text-gray-500"
            />
          </div>
        )}
        {isOutlook ? (
          <span className="flex-1 text-sm truncate" title={item.title}>
            {item.title}
          </span>
        ) : (
          <input
            value={item.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="予定"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        )}
        {isOutlook && (
          <span className="text-[10px] text-navy/50 shrink-0">Outlook</span>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="text-gray-300 hover:text-accent shrink-0 px-0.5"
          aria-label="削除"
        >
          ✕
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="shrink-0 text-gray-400 text-sm leading-none" aria-hidden>
          💬
        </span>
        <input
          value={item.resultNote}
          onChange={(e) => onChange({ resultNote: e.target.value })}
          placeholder="ひとことコメント…"
          aria-label="ひとことコメント"
          className="w-full bg-white rounded-md border border-rule focus:border-navy px-2 py-1 outline-none text-sm text-gray-700 placeholder:text-gray-400 transition"
        />
      </div>
    </div>
  );
}

function SaveIndicator({
  state,
  savedAt,
}: {
  state: SaveState;
  savedAt: Date | null;
}) {
  let text = "";
  let color = "text-gray-400";
  if (state === "saving" || state === "pending") {
    text = "保存中…";
  } else if (state === "saved") {
    text = savedAt
      ? `保存済み ${pad(savedAt.getHours())}:${pad(savedAt.getMinutes())}`
      : "保存済み";
    color = "text-green-600";
  } else if (state === "error") {
    text = "保存に失敗（自動で再試行します）";
    color = "text-accent";
  }
  return <span className={`text-xs ${color}`}>{text}</span>;
}
