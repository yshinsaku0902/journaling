"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  Challenge,
  ChallengeCategory,
  ChallengeStatus,
} from "@/lib/challenge";
import {
  CHALLENGE_CATEGORIES,
  CHALLENGE_STATUS,
  NEXT_STATUS,
  categoryMeta,
  summarizeChallenges,
} from "@/lib/challenge";
import { jpDateParts } from "@/lib/date";

const STATUS_ORDER: ChallengeStatus[] = ["open", "doing", "resolved"];

// ISO文字列 → 「M/D」
function fmtIsoMd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
// yyyy-MM-dd → 「M/D（曜）」
function fmtSourceDate(date: string): string {
  const { month, day, weekday } = jpDateParts(date);
  return `${month}/${day}（${weekday}）`;
}

export function ChallengeBoard({
  initialChallenges,
}: {
  initialChallenges: Challenge[];
}) {
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<ChallengeCategory>(
    CHALLENGE_CATEGORIES[0].key,
  );
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => summarizeChallenges(challenges), [challenges]);
  const activeCats = summary.byCategory
    .filter((c) => c.open > 0)
    .sort((a, b) => b.open - a.open);
  const maxOpen = Math.max(1, ...activeCats.map((c) => c.open));

  async function add() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, category }),
      });
      if (!res.ok) throw new Error();
      const { challenge } = await res.json();
      setChallenges((prev) => [challenge as Challenge, ...prev]);
      setText("");
    } catch {
      setError("追加に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const { challenge } = await res.json();
      setChallenges((prev) =>
        prev.map((c) => (c.id === id ? (challenge as Challenge) : c)),
      );
    } catch {
      setError("更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    if (!window.confirm("この経営課題を削除しますか？")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setChallenges((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {/* ダッシュボード＋追加フォーム */}
      <div className="bg-white rounded-2xl shadow-sm border border-rule p-4">
        <div className="grid grid-cols-3 gap-2">
          {STATUS_ORDER.map((s) => {
            const meta = CHALLENGE_STATUS[s];
            return (
              <div
                key={s}
                className="rounded-xl bg-gray-50 border border-rule px-3 py-2 text-center"
              >
                <div
                  className="text-xl font-bold tabular-nums leading-none"
                  style={{ color: meta.color }}
                >
                  {summary.statusCounts[s]}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {meta.label}
                </div>
              </div>
            );
          })}
        </div>

        {activeCats.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {activeCats.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-right text-xs text-gray-600">
                  {c.label}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(c.open / maxOpen) * 100}%`,
                      backgroundColor: c.color,
                    }}
                  />
                </div>
                <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-navy">
                  {c.open}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-center text-sm text-gray-400">
            未解決の経営課題はありません 🎉
          </p>
        )}

        {/* 追加フォーム */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-rule pt-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            placeholder="気づいた経営課題を書く…"
            aria-label="経営課題を追加"
            className="min-w-[12rem] flex-1 rounded-lg border border-rule bg-white px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ChallengeCategory)}
            aria-label="カテゴリ"
            className="rounded-lg border border-rule bg-white px-2 py-2 text-sm outline-none focus:border-navy"
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
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            ＋ 追加
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-accent">{error}</p>}
      </div>

      {/* 未解決の課題カード */}
      {summary.unresolved.length > 0 && (
        <ul className="space-y-2">
          {summary.unresolved.map((c) => {
            const meta = categoryMeta(c.category);
            const status = CHALLENGE_STATUS[c.status];
            return (
              <li
                key={c.id}
                className="rounded-2xl border border-rule bg-white p-3.5 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => void patch(c.id, { status: NEXT_STATUS[c.status] })}
                    title="タップでステータス変更"
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white transition hover:opacity-85"
                    style={{ backgroundColor: status.color }}
                  >
                    {status.label}
                  </button>
                  <p className="flex-1 whitespace-pre-wrap break-words text-sm text-ink/90">
                    {c.text}
                  </p>
                  <button
                    type="button"
                    onClick={() => void remove(c.id)}
                    className="shrink-0 px-1 text-gray-300 hover:text-accent"
                    aria-label="削除"
                  >
                    ✕
                  </button>
                </div>
                {c.note && (
                  <p className="mt-1.5 whitespace-pre-wrap break-words pl-1 text-xs text-gray-500">
                    {c.note}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    {meta.label}
                  </span>
                  {c.sourceDate ? (
                    <Link
                      href={`/journal/${c.sourceDate}`}
                      className="text-xs text-navy hover:underline"
                    >
                      📅 {fmtSourceDate(c.sourceDate)}の記入
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">
                      {fmtIsoMd(c.createdAt)} 登録
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 解決済み（振り返り用・折りたたみ） */}
      {summary.resolved.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs text-gray-500 hover:text-navy"
          >
            {showResolved ? "▼" : "▶"} 解決済み（{summary.resolved.length}件）
          </button>
          {showResolved && (
            <ul className="mt-2 space-y-1.5">
              {summary.resolved.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border border-rule bg-gray-50 px-3 py-2"
                >
                  <span
                    className="shrink-0 text-xs font-bold"
                    style={{ color: CHALLENGE_STATUS.resolved.color }}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="flex-1 break-words text-sm text-gray-500 line-through">
                    {c.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => void patch(c.id, { status: "open" })}
                    className="shrink-0 text-xs text-navy hover:underline"
                  >
                    戻す
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(c.id)}
                    className="shrink-0 px-0.5 text-gray-300 hover:text-accent"
                    aria-label="削除"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
