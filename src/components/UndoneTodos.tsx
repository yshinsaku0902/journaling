"use client";

// トップページのTODO欄。
// ・ここから今日のTODOを直接追加できる
// ・未完了は月をまたいでも消えず、「繰り越し」として追い続ける
// ・✓ で完了すると、行が消える演出＋今日の完了スタンプで達成感を出す
//   （いずれも元の日記が更新される）
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TodoBoard, UndoneTodo } from "@/lib/stats";
import type { ItemKind, JournalItem } from "@/lib/types";
import { itemKindMeta } from "@/lib/types";
import { newId } from "@/lib/schedule";
import { daysBetween, jpDateParts } from "@/lib/date";

// 完了時にランダムで出す掛け声
const CHEERS = ["ナイス！", "いいね！", "その調子！", "よし！", "さすが！"];

const keyOf = (t: UndoneTodo) => `${t.date}:${t.id}`;
// 内容で同一判定する（保存のたびに id が振り直されるため）
const sigOf = (t: UndoneTodo) => `${t.date}::${t.text}`;

// 「今日かたづけた分」の記録。
// サーバーは各TODOの記入日しか持たないので、繰り越しTODOを今日完了しても
// サーバー側からは「今日の完了」に見えない。そこで、この端末で今日チェックした
// ぶんを localStorage に控えて達成感の表示に使う（1日で捨てる）。
const DONE_KEY_PREFIX = "journal:doneToday:";

function readLocalDone(today: string): UndoneTodo[] {
  try {
    const raw = localStorage.getItem(DONE_KEY_PREFIX + today);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as UndoneTodo[]) : [];
  } catch {
    return [];
  }
}

function writeLocalDone(today: string, list: UndoneTodo[]) {
  try {
    localStorage.setItem(DONE_KEY_PREFIX + today, JSON.stringify(list));
    // 前日までの記録は捨てる
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(DONE_KEY_PREFIX) && k !== DONE_KEY_PREFIX + today) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // プライベートモードなどで保存できなくても表示は動く
  }
}

// 繰り越し日数に応じた見た目（放置するほど目立つ）
function ageStyle(days: number): { cls: string; label: string } {
  if (days >= 14)
    return { cls: "bg-accent/10 text-accent", label: `${days}日` };
  if (days >= 7)
    return { cls: "bg-amber-100 text-amber-700", label: `${days}日` };
  return { cls: "bg-gray-100 text-gray-500", label: `${days}日` };
}

export function UndoneTodos({
  initial,
  today,
}: {
  initial: TodoBoard;
  today: string;
}) {
  const router = useRouter();
  const [undone, setUndone] = useState<UndoneTodo[]>(initial.undone);
  const [serverDone, setServerDone] = useState<UndoneTodo[]>(initial.doneToday);
  const [localDone, setLocalDone] = useState<UndoneTodo[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const [cheer, setCheer] = useState<{
    id: number;
    text: string;
    count: number;
    all: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<ItemKind>("work");
  const [showDone, setShowDone] = useState(false);

  // router.refresh() 後のサーバー最新値に追従する。
  // Postgres 保存時は journal_items を作り直すので id が振り直される。
  // 楽観更新で足した行を残すと id がズレるため、必ずサーバー値へ同期する。
  useEffect(() => {
    setUndone(initial.undone);
    setServerDone(initial.doneToday);
  }, [initial]);

  // この端末で今日かたづけたぶんを読み戻す（初回のみ）
  useEffect(() => {
    setLocalDone(readLocalDone(today));
  }, [today]);

  // 今日の完了 ＝ サーバー（今日づけのTODO）＋ この端末の記録（繰り越しぶんを含む）。
  // 同じ内容が未完了に戻っていたら数えない（日記側で外した場合に自動で直る）。
  const doneToday = useMemo(() => {
    const undoneSigs = new Set(undone.map(sigOf));
    const seen = new Set<string>();
    const merged: UndoneTodo[] = [];
    for (const t of [...serverDone, ...localDone]) {
      const sig = sigOf(t);
      if (undoneSigs.has(sig) || seen.has(sig)) continue;
      seen.add(sig);
      merged.push(t);
    }
    return merged;
  }, [serverDone, localDone, undone]);

  // 掛け声トーストは少し出して自動で消す
  useEffect(() => {
    if (!cheer) return;
    const t = setTimeout(() => setCheer(null), 2000);
    return () => clearTimeout(t);
  }, [cheer]);

  // 期限（記入日）で3つに分ける。繰り越しをいちばん上に置いて忘れない。
  const groups = useMemo(() => {
    const overdue = undone.filter((t) => t.date < today);
    const todays = undone.filter((t) => t.date === today);
    const upcoming = undone.filter((t) => t.date > today);
    return { overdue, todays, upcoming };
  }, [undone, today]);

  // 今日のジャーナルにTODOを1件追加する（既存の記入は保持）。
  async function add() {
    const t = text.trim();
    if (!t || busyKey) return;
    setBusyKey("add");
    setError(null);
    try {
      const res = await fetch(`/api/entry/${today}`);
      if (!res.ok) throw new Error();
      const entry = await res.json();
      const items: JournalItem[] = Array.isArray(entry.items) ? entry.items : [];
      const nextItems: JournalItem[] = [
        ...items,
        {
          id: newId(),
          text: t,
          done: false,
          achievement: 0,
          kind,
          sortOrder: items.length,
        },
      ];
      const save = await fetch(`/api/entry/${today}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entry, items: nextItems }),
      });
      if (!save.ok) throw new Error();
      setText("");
      router.refresh(); // 一覧とカレンダーのバッジはサーバー値で更新
    } catch {
      setError("追加に失敗しました。");
    } finally {
      setBusyKey(null);
    }
  }

  // 元の記入を取得 → items を書き換え → 丸ごと保存（他の項目は保持）。
  async function patchItem(
    t: UndoneTodo,
    action: "done" | "delete" | "undo",
  ): Promise<void> {
    const res = await fetch(`/api/entry/${t.date}`);
    if (!res.ok) throw new Error();
    const entry = await res.json();
    const items: JournalItem[] = Array.isArray(entry.items) ? entry.items : [];
    // Postgres 保存では id が振り直されるため、見つからなければ本文で照合する。
    const target =
      items.find((i) => i.id === t.id) ??
      items.find((i) => i.text.trim() === t.text);
    if (!target) throw new Error();
    const nextItems =
      action === "delete"
        ? items.filter((i) => i.id !== target.id)
        : items.map((i) =>
            i.id === target.id ? { ...i, done: action === "done" } : i,
          );
    const save = await fetch(`/api/entry/${t.date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, items: nextItems }),
    });
    if (!save.ok) throw new Error();
  }

  // 完了：行が消える演出 → 今日の完了スタンプへ移動 → 掛け声
  async function complete(t: UndoneTodo) {
    const key = keyOf(t);
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      await patchItem(t, "done");
      const isLast = undone.length === 1;
      setClearingKey(key);
      setCheer({
        id: Date.now(),
        text: CHEERS[Math.floor(Math.random() * CHEERS.length)],
        count: doneToday.length + 1,
        all: isLast,
      });
      setLocalDone((prev) => {
        const next = [...prev.filter((x) => sigOf(x) !== sigOf(t)), t];
        writeLocalDone(today, next);
        return next;
      });
      setTimeout(() => {
        setClearingKey(null);
        setUndone((prev) => prev.filter((x) => keyOf(x) !== key));
        router.refresh(); // カレンダーのバッジ件数も更新
      }, 420);
    } catch {
      setError("更新に失敗しました。");
    } finally {
      setBusyKey(null);
    }
  }

  // 削除：完了ではないので掛け声は出さない
  async function remove(t: UndoneTodo) {
    const key = keyOf(t);
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      await patchItem(t, "delete");
      setClearingKey(key);
      setTimeout(() => {
        setClearingKey(null);
        setUndone((prev) => prev.filter((x) => keyOf(x) !== key));
        router.refresh();
      }, 420);
    } catch {
      setError("更新に失敗しました。");
    } finally {
      setBusyKey(null);
    }
  }

  // 完了を取り消して未完了に戻す
  async function restore(t: UndoneTodo) {
    const key = keyOf(t);
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      await patchItem(t, "undo");
      setServerDone((prev) => prev.filter((x) => sigOf(x) !== sigOf(t)));
      setLocalDone((prev) => {
        const next = prev.filter((x) => sigOf(x) !== sigOf(t));
        writeLocalDone(today, next);
        return next;
      });
      setUndone((prev) =>
        [...prev, t].sort((a, b) => a.date.localeCompare(b.date)),
      );
      router.refresh();
    } catch {
      setError("更新に失敗しました。");
    } finally {
      setBusyKey(null);
    }
  }

  const overdueCount = groups.overdue.length;
  const doneCount = doneToday.length;

  return (
    <section className="mt-4 rounded-2xl border border-rule bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-bold text-navy">🔲 TODO</h2>
        <span className="text-[11px] text-gray-400">
          {overdueCount > 0 && (
            <span className="mr-2 font-bold text-accent">
              繰り越し {overdueCount}件
            </span>
          )}
          未完了 {undone.length}件
        </span>
      </div>

      {/* 今日のTODOをその場で追加 */}
      <div className="mt-2 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // IME変換中のEnterで送信しない
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="やること・TODOを書く…"
          aria-label="今日のTODOを追加"
          className="field-line min-w-0 flex-1 text-sm"
        />
        <button
          type="button"
          onClick={() => setKind((k) => (k === "work" ? "private" : "work"))}
          className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold text-white transition hover:opacity-85"
          style={{ backgroundColor: itemKindMeta(kind).color }}
          title="仕事／プライベートを切替"
        >
          {itemKindMeta(kind).label}
        </button>
        <button
          type="button"
          onClick={() => void add()}
          disabled={busyKey != null || !text.trim()}
          className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          ＋追加
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        今日（{jpDateParts(today).month}/{jpDateParts(today).day}
        ）のTODOとして登録されます
      </p>

      {error && <p className="mt-1 text-xs text-accent">{error}</p>}

      {/* 今日かたづけた分（達成感の見える化） */}
      {doneCount > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">
              🎉 今日かたづけた{" "}
              <span className="text-base tabular-nums">{doneCount}</span>件
              {doneCount >= 5 && <span className="ml-1">🔥 絶好調！</span>}
              {doneCount >= 3 && doneCount < 5 && (
                <span className="ml-1">いい流れ！</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="shrink-0 text-[11px] text-emerald-700/70 underline underline-offset-2"
            >
              {showDone ? "たたむ" : "見る"}
            </button>
          </div>
          {/* 完了スタンプ（1件＝1個） */}
          <div className="mt-1 flex flex-wrap gap-0.5" aria-hidden>
            {doneToday.slice(0, 30).map((t) => (
              <span key={keyOf(t)} className="sparkle-pop text-sm leading-none">
                ✅
              </span>
            ))}
          </div>
          {showDone && (
            <ul className="mt-1.5 space-y-0.5">
              {doneToday.map((t) => (
                <li
                  key={keyOf(t)}
                  className="flex items-center gap-2 text-sm text-emerald-900/60"
                >
                  <span className="min-w-0 flex-1 truncate line-through">
                    {t.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => void restore(t)}
                    disabled={busyKey != null}
                    title="未完了に戻す"
                    aria-label="未完了に戻す"
                    className="shrink-0 px-1 text-[11px] text-emerald-700/70 transition hover:text-emerald-800 disabled:opacity-40"
                  >
                    ↩︎戻す
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {undone.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 px-3 py-4 text-center">
          <div className="sparkle-pop text-2xl">🎊</div>
          <p className="mt-1 text-sm font-bold text-emerald-700">
            やり残しゼロ！
          </p>
          <p className="text-[11px] text-emerald-700/70">
            繰り越しはありません。気持ちよく次へ。
          </p>
        </div>
      )}

      <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
        <TodoGroup
          label="⏳ 繰り越し"
          hint="片づくまで毎日ここに出ます"
          tone="overdue"
          todos={groups.overdue}
          today={today}
          busyKey={busyKey}
          clearingKey={clearingKey}
          onDone={complete}
          onDelete={remove}
        />
        <TodoGroup
          label="📌 今日"
          tone="today"
          todos={groups.todays}
          today={today}
          busyKey={busyKey}
          clearingKey={clearingKey}
          onDone={complete}
          onDelete={remove}
        />
        <TodoGroup
          label="🗓 これから"
          tone="upcoming"
          todos={groups.upcoming}
          today={today}
          busyKey={busyKey}
          clearingKey={clearingKey}
          onDone={complete}
          onDelete={remove}
        />
      </div>

      {undone.length > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          「✓ 完了」で片づけ ・ ✕で削除 ・ 日付をタップでその日を開く
        </p>
      )}

      {/* 完了したときの掛け声 */}
      {cheer && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <div
            key={cheer.id}
            className="cheer-toast rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg"
          >
            {cheer.all
              ? "🎊 全部かたづいた！おつかれさま！"
              : `🎉 ${cheer.text} 今日 ${cheer.count}件目`}
          </div>
        </div>
      )}
      {cheer?.all && <Confetti runId={cheer.id} />}
    </section>
  );
}

// 期間ごとのTODOリスト（繰り越し / 今日 / これから）
function TodoGroup({
  label,
  hint,
  tone,
  todos,
  today,
  busyKey,
  clearingKey,
  onDone,
  onDelete,
}: {
  label: string;
  hint?: string;
  tone: "overdue" | "today" | "upcoming";
  todos: UndoneTodo[];
  today: string;
  busyKey: string | null;
  clearingKey: string | null;
  onDone: (t: UndoneTodo) => void;
  onDelete: (t: UndoneTodo) => void;
}) {
  if (todos.length === 0) return null;
  const headColor =
    tone === "overdue"
      ? "text-accent"
      : tone === "today"
        ? "text-navy"
        : "text-gray-500";
  return (
    <div>
      <div className="flex items-baseline gap-2 px-1">
        <span className={`text-[11px] font-bold ${headColor}`}>
          {label} {todos.length}件
        </span>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
      </div>
      <ul className="mt-0.5 space-y-0.5">
        {todos.map((t) => {
          const km = itemKindMeta(t.kind);
          const p = jpDateParts(t.date);
          const key = keyOf(t);
          const busy = busyKey === key;
          const age = daysBetween(t.date, today);
          const aged = tone === "overdue" ? ageStyle(age) : null;
          return (
            <li
              key={key}
              className={`flex items-center gap-2 rounded-md px-1 py-1 hover:bg-gray-50 ${
                clearingKey === key ? "todo-clear" : ""
              } ${busy ? "opacity-50" : ""} ${
                tone === "overdue" ? "bg-accent/[0.03]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onDone(t)}
                disabled={busyKey != null}
                title="完了にする"
                className="shrink-0 rounded-full border border-emerald-500/70 bg-emerald-50 px-2 py-1 text-[10px] font-bold leading-none text-emerald-700 transition hover:bg-emerald-600 hover:text-white active:scale-95 disabled:opacity-40"
              >
                ✓ 完了
              </button>
              <Link
                href={`/journal/${t.date}`}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <span className="w-14 shrink-0 text-xs tabular-nums text-gray-500">
                  {p.month}/{p.day}（{p.weekday}）
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: km.color }}
                  title={km.label}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-ink/90">
                  {t.text}
                </span>
                {aged ? (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${aged.cls}`}
                    title={`${age}日前のTODO`}
                  >
                    {aged.label}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {km.label}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => onDelete(t)}
                disabled={busyKey != null}
                title="削除"
                aria-label="削除"
                className="shrink-0 px-1 text-gray-300 transition hover:text-accent disabled:opacity-40"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 全部かたづいたときの紙吹雪（クリック後にだけ描画されるので位置はランダムでよい）
function Confetti({ runId }: { runId: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 400,
        emoji: ["🎉", "✨", "🎊", "⭐"][i % 4],
      })),
    // runId ごとに撒き直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId],
  );
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-0 text-xl"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}ms` }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
