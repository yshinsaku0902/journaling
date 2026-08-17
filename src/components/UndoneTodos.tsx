"use client";

// トップページの「やり残しTODO」一覧。
// 各行を ✓ で完了 / ✕ で削除でき、その場でトップから消せる（元の日記も更新される）。
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UndoneTodo } from "@/lib/stats";
import type { JournalItem } from "@/lib/types";
import { itemKindMeta } from "@/lib/types";
import { jpDateParts } from "@/lib/date";

export function UndoneTodos({ initial }: { initial: UndoneTodo[] }) {
  const router = useRouter();
  const [todos, setTodos] = useState<UndoneTodo[]>(initial);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (todos.length === 0) return null;

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
        <h2 className="text-base font-bold text-navy">🔲 やり残しTODO</h2>
        <span className="text-[11px] text-gray-400">{todos.length}件</span>
      </div>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
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
      <p className="mt-2 text-[11px] text-gray-400">
        ✓で完了 ・ ✕で削除 ・ 日付をタップでその日を開く
      </p>
    </section>
  );
}
