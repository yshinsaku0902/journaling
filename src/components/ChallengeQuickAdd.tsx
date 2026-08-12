"use client";

// MEMO欄の下に常時表示する「経営課題」記入欄。
// 自分で書いて「追加」すると sourceDate にその日をひも付けて登録され、
// トップの経営課題ダッシュボードに反映される。その日に登録済みの課題も一覧表示する。
import { useEffect, useState } from "react";
import type { Challenge, ChallengeCategory } from "@/lib/challenge";
import { CHALLENGE_CATEGORIES, categoryMeta } from "@/lib/challenge";

export function ChallengeQuickAdd({ date }: { date: string }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<ChallengeCategory>(
    CHALLENGE_CATEGORIES[0].key,
  );
  const [items, setItems] = useState<Challenge[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // その日にひも付いた経営課題を読み込む。
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/challenges");
        if (!res.ok) return;
        const { challenges } = await res.json();
        if (alive) {
          setItems(
            (challenges as Challenge[]).filter((c) => c.sourceDate === date),
          );
        }
      } catch {
        // 取得失敗は致命ではない（記入は可能）
      }
    })();
    return () => {
      alive = false;
    };
  }, [date]);

  async function add() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, category, sourceDate: date }),
      });
      if (!res.ok) throw new Error();
      const { challenge } = await res.json();
      setItems((prev) => [challenge as Challenge, ...prev]);
      setText("");
    } catch {
      setError("追加に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <label className="block text-xs font-medium text-gray-500">
        経営課題（この日の気づき）
      </label>

      {/* この日に登録済みの経営課題 */}
      {items.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {items.map((c) => {
            const meta = categoryMeta(c.category);
            return (
              <li
                key={c.id}
                className="flex items-start gap-2 rounded-lg border border-navy/15 bg-navy/5 px-3 py-2"
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="flex-1 whitespace-pre-wrap break-words text-sm text-ink/90">
                  {c.text}
                </span>
                <span className="shrink-0 text-[11px] text-gray-500">
                  {meta.label}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  className="shrink-0 px-0.5 text-gray-300 hover:text-accent"
                  aria-label="削除"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 記入欄 */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void add();
          }
        }}
        rows={2}
        placeholder="今日気づいた経営課題を書く…"
        aria-label="経営課題を記入"
        className="mt-1.5 w-full rounded-lg border border-rule bg-transparent px-3 py-2 outline-none transition focus:border-navy"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ChallengeCategory)}
          aria-label="カテゴリ"
          className="rounded-lg border border-rule bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
        >
          {CHALLENGE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy || !text.trim()}
          className="rounded-lg bg-navy px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          ＋ 経営課題に追加
        </button>
        <span className="text-[11px] text-gray-400">
          トップの経営課題に登録されます
        </span>
        {error && <span className="text-xs text-accent">{error}</span>}
      </div>
    </div>
  );
}
