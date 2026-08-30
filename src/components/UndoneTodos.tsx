"use client";

// トップページのTODO欄。
// ここから今日のTODOを直接追加でき、やり残しは ✓ で完了 / ✕ で削除できる
// （いずれも元の日記が更新される）。
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UndoneTodo } from "@/lib/stats";
import type { ItemKind, JournalItem } from "@/lib/types";
import { itemKindMeta } from "@/lib/types";
import { newId } from "@/lib/schedule";
import { jpDateParts } from "@/lib/date";

export function UndoneTodos({
  initial,
  today,
}: {
  initial: UndoneTodo[];
  today: string;
}) {
  const router = useRouter();
  const [todos, setTodos] = useState<UndoneTodo[]>(initial);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<ItemKind>("work");

  // router.refresh() 後のサーバー最新値に追従する。
  // Postgres 保存時は journal_items を作り直すので id が振り直される。
  // 楽観更新で足した行を残すと id がズレるため、必ずサーバー値へ同期する。
  useEffect(() => {
    setTodos(initial);
  }, [initial]);

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

  // 該当TODOを完了(done)／削除(delete)する。
  // 元の記入を取得 → items を書き換え → 丸ごと保存（他の項目は保持）。
  async function resolve(t: UndoneTodo, action: "done" | "delete") {
    const key = `${t.date}:${t.id}`;
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch(`/api/entry/${t.date}`);
      if (!res.ok) throw new Error();
      const entry = await res.json();
      const items: JournalItem[] = Array.isArray(entry.items) ? entry.items : [];
      const nextItems =
        action === "delete"
          ? items.filter((i) => i.id !== t.id)
          : items.map((i) => (i.id === t.id ? { ...i, done: true } : i));
      const save = await fetch(`/api/entry/${t.date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entry, items: nextItems }),
      });
      if (!save.ok) throw new Error();
      setTodos((prev) =>
        prev.filter((x) => !(x.date === t.date && x.id === t.id)),
      );
      router.refresh(); // カレンダーのバッジ件数も更新
    } catch {
      setError("更新に失敗しました。");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-rule bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-bold text-navy">🔲 TODO</h2>
        <span className="text-[11px] text-gray-400">やり残し {todos.length}件</span>
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
        今日（{jpDateParts(today).month}/{jpDateParts(today).day}）のTODOとして登録されます
      </p>

      {error && <p className="mt-1 text-xs text-accent">{error}</p>}

      {todos.length === 0 && (
        <p className="mt-3 text-sm text-gray-400">やり残しはありません 🎉</p>
      )}

      <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto">
        {todos.map((t) => {
          const km = itemKindMeta(t.kind);
          const p = jpDateParts(t.date);
          const key = `${t.date}:${t.id}`;
          const busy = busyKey === key;
          return (
            <li
              key={key}
              className={`flex items-center gap-2 rounded-md px-1 py-1 hover:bg-gray-50 ${
                busy ? "opacity-50" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => void resolve(t, "done")}
                disabled={busyKey != null}
                title="完了にする"
                aria-label="完了にする"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[11px] text-gray-400 transition hover:border-green-600 hover:bg-green-50 hover:text-green-600 disabled:opacity-40"
              >
                ✓
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
                <span className="shrink-0 text-[10px] text-gray-400">
                  {km.label}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void resolve(t, "delete")}
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
      {todos.length > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          ✓で完了 ・ ✕で削除 ・ 日付をタップでその日を開く
        </p>
      )}
    </section>
  );
}
