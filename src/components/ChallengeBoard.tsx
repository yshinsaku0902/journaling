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
  categoryMeta,
  summarizeChallenges,
} from "@/lib/challenge";
import { jpDateParts } from "@/lib/date";

const STATUS_ORDER: ChallengeStatus[] = ["open", "doing", "resolved"];
const STATUS_RANK: Record<ChallengeStatus, number> = {
  open: 0,
  doing: 1,
  resolved: 2,
};

// ステータス絞り込み: active=未解決(未着手+対応中) / all=すべて / 各ステータス
type StatusFilter = "active" | "all" | ChallengeStatus;
type CatFilter = "all" | ChallengeCategory;

// 一覧を一度に描画する上限（増えても重くならないように「もっと見る」で伸ばす）
const PAGE_SIZE = 40;

// 色付きセレクト（ステータス変更ピル）の白い下向きキャレット
const CARET =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E\")";

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
// yyyy-MM-dd → 「M/D」（コンパクト表示用）
function fmtMd(date: string): string {
  const { month, day } = jpDateParts(date);
  return `${month}/${day}`;
}

export function ChallengeBoard({
  initialChallenges,
}: {
  initialChallenges: Challenge[];
}) {
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 追加フォーム
  const [text, setText] = useState("");
  const [category, setCategory] = useState<ChallengeCategory>(
    CHALLENGE_CATEGORIES[0].key,
  );

  // 絞り込み
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [catFilter, setCatFilter] = useState<CatFilter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  // 一覧の表示密度。既定はコンパクト（1行）で、1スクロールで多く見られる。
  const [dense, setDense] = useState(true);

  // インライン編集
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState<ChallengeCategory>("other");
  const [editNote, setEditNote] = useState("");

  const summary = useMemo(() => summarizeChallenges(challenges), [challenges]);
  const activeCats = summary.byCategory
    .filter((c) => c.open > 0)
    .sort((a, b) => b.open - a.open);
  const maxOpen = Math.max(1, ...activeCats.map((c) => c.open));

  // ステータス＋キーワードで絞った集合（カテゴリ絞りは含めない＝ファセット件数の母集合）
  const statusScoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return challenges.filter((c) => {
      if (statusFilter === "active" && c.status === "resolved") return false;
      if (
        statusFilter !== "active" &&
        statusFilter !== "all" &&
        c.status !== statusFilter
      ) {
        return false;
      }
      if (q && !`${c.text}\n${c.note}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [challenges, statusFilter, query]);

  // カテゴリチップの件数（現在のステータス／キーワード条件下での件数）
  const catCounts = useMemo(() => {
    const m = new Map<ChallengeCategory, number>();
    for (const c of statusScoped) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return m;
  }, [statusScoped]);

  // 実際に表示するリスト（カテゴリ絞り＋並び替え）
  const filtered = useMemo(() => {
    const list =
      catFilter === "all"
        ? statusScoped
        : statusScoped.filter((c) => c.category === catFilter);
    return [...list].sort((a, b) => {
      if (a.status === "resolved" && b.status === "resolved") {
        return (b.resolvedAt ?? b.updatedAt).localeCompare(
          a.resolvedAt ?? a.updatedAt,
        );
      }
      return (
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.updatedAt.localeCompare(a.updatedAt)
      );
    });
  }, [statusScoped, catFilter]);

  const visible = filtered.slice(0, limit);
  const filtersOn =
    statusFilter !== "active" || catFilter !== "all" || query.trim() !== "";

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

  // 部分更新。成功したら true を返す（編集保存後のUI遷移に使う）。
  async function patch(id: string, body: Record<string, unknown>) {
    if (busy) return false;
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
      return true;
    } catch {
      setError("更新に失敗しました。");
      return false;
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

  function startEdit(c: Challenge) {
    setEditingId(c.id);
    setEditText(c.text);
    setEditCategory(c.category);
    setEditNote(c.note);
  }

  async function saveEdit(id: string) {
    const t = editText.trim();
    if (!t) return;
    const ok = await patch(id, {
      text: t,
      category: editCategory,
      note: editNote.trim(),
    });
    if (ok) setEditingId(null);
  }

  // ステータスタイルのクリック → その状態で絞り込み（再クリックで未解決に戻す）
  function toggleStatusFilter(s: ChallengeStatus) {
    setLimit(PAGE_SIZE);
    setStatusFilter((cur) => (cur === s ? "active" : s));
  }
  function toggleCatFilter(key: ChallengeCategory) {
    setLimit(PAGE_SIZE);
    setCatFilter((cur) => (cur === key ? "all" : key));
  }

  // ステータス変更ピル（コンパクト/詳細どちらの行でも共通で使う）
  const statusSelect = (c: Challenge, compact = false) => (
    <select
      value={c.status}
      onChange={(e) =>
        void patch(c.id, { status: e.target.value as ChallengeStatus })
      }
      disabled={busy}
      aria-label="ステータスを変更"
      title="ステータスを変更"
      className={`shrink-0 cursor-pointer appearance-none rounded-full font-bold text-white outline-none disabled:opacity-60 ${
        compact ? "py-0 pl-1.5 pr-3.5 text-[10px]" : "py-0.5 pl-2.5 pr-6 text-xs"
      }`}
      style={{
        backgroundColor: CHALLENGE_STATUS[c.status].color,
        backgroundImage: CARET,
        backgroundRepeat: "no-repeat",
        backgroundPosition: compact ? "right 0.3rem center" : "right 0.45rem center",
        backgroundSize: compact ? "0.42rem" : "0.6rem",
      }}
    >
      {STATUS_ORDER.map((s) => (
        <option
          key={s}
          value={s}
          style={{ color: "#111827", backgroundColor: "#fff" }}
        >
          {CHALLENGE_STATUS[s].label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="mt-3 space-y-3">
      {/* ダッシュボード＋追加フォーム */}
      <div className="bg-white rounded-2xl shadow-sm border border-rule p-4">
        <div className="grid grid-cols-3 gap-2">
          {STATUS_ORDER.map((s) => {
            const meta = CHALLENGE_STATUS[s];
            const on = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatusFilter(s)}
                aria-pressed={on}
                title={on ? "絞り込み解除" : `${meta.label}だけ表示`}
                className={`rounded-xl border px-3 py-2 text-center transition ${
                  on
                    ? "border-navy bg-navy/5 ring-1 ring-navy"
                    : "border-rule bg-gray-50 hover:bg-gray-100"
                }`}
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
              </button>
            );
          })}
        </div>

        {activeCats.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {activeCats.map((c) => {
              const on = catFilter === c.key;
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => toggleCatFilter(c.key)}
                    aria-pressed={on}
                    title={on ? "絞り込み解除" : `${c.label}だけ表示`}
                    className={`flex w-full items-center gap-2 rounded-lg px-1 py-0.5 transition hover:bg-gray-50 ${
                      on ? "bg-navy/5 ring-1 ring-navy/40" : ""
                    }`}
                  >
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
                  </button>
                </li>
              );
            })}
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

      {/* 絞り込みツールバー */}
      <div className="rounded-2xl border border-rule bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="経営課題を検索…"
              aria-label="経営課題を検索"
              className="w-full rounded-lg border border-rule bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-navy"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setLimit(PAGE_SIZE);
            }}
            aria-label="ステータスで絞り込み"
            className="rounded-lg border border-rule bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
          >
            <option value="active">未解決</option>
            <option value="open">未着手</option>
            <option value="doing">対応中</option>
            <option value="resolved">解決済み</option>
            <option value="all">すべて</option>
          </select>
        </div>

        {/* カテゴリチップ（件数付き） */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setCatFilter("all");
              setLimit(PAGE_SIZE);
            }}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
              catFilter === "all"
                ? "border-navy bg-navy text-white"
                : "border-rule bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            すべて {statusScoped.length}
          </button>
          {CHALLENGE_CATEGORIES.map((c) => {
            const n = catCounts.get(c.key) ?? 0;
            if (n === 0) return null;
            const on = catFilter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleCatFilter(c.key)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition ${
                  on
                    ? "border-navy bg-navy text-white"
                    : "border-rule bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
                {c.label} {n}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
          <span>{filtered.length}件を表示</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDense((v) => !v)}
              className="text-navy hover:underline"
              title="1行表示と詳細表示を切り替え"
            >
              {dense ? "詳細表示" : "コンパクト表示"}
            </button>
            {filtersOn && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("active");
                  setCatFilter("all");
                  setQuery("");
                  setLimit(PAGE_SIZE);
                }}
                className="text-navy hover:underline"
              >
                絞り込みを解除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 課題リスト（コンパクト表示・インライン編集） */}
      {visible.length > 0 ? (
        <ul
          className={
            dense
              ? "grid grid-cols-2 gap-1.5"
              : "space-y-2"
          }
        >
          {visible.map((c) => {
            const meta = categoryMeta(c.category);
            const isResolved = c.status === "resolved";
            const editing = editingId === c.id;
            return (
              <li
                key={c.id}
                className={
                  editing
                    ? "col-span-2 rounded-2xl border border-rule bg-white p-3 shadow-sm"
                    : !dense
                      ? "rounded-2xl border border-rule bg-white p-3 shadow-sm"
                      : "relative overflow-hidden rounded-lg border border-rule bg-white"
                }
              >
                {editing ? (
                  /* ---- 編集フォーム ---- */
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={2}
                      aria-label="課題の内容"
                      className="w-full rounded-lg border border-rule bg-white px-3 py-2 text-sm outline-none focus:border-navy"
                    />
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={1}
                      placeholder="補足メモ（任意）"
                      aria-label="補足メモ"
                      className="w-full rounded-lg border border-rule bg-white px-3 py-2 text-xs outline-none focus:border-navy"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={editCategory}
                        onChange={(e) =>
                          setEditCategory(e.target.value as ChallengeCategory)
                        }
                        aria-label="カテゴリ"
                        className="rounded-lg border border-rule bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
                      >
                        {CHALLENGE_CATEGORIES.map((cat) => (
                          <option key={cat.key} value={cat.key}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void remove(c.id)}
                        className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-accent"
                        title="この経営課題を削除"
                      >
                        削除
                      </button>
                      <div className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEdit(c.id)}
                          disabled={busy || !editText.trim()}
                          className="rounded-lg bg-navy px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : dense ? (
                  /* ---- コンパクト表示（2列グリッドのチップ・1行） ---- */
                  <div className="flex items-center gap-1.5 py-1 pl-2.5 pr-1.5">
                    {/* 左端の色帯＝カテゴリ */}
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ backgroundColor: meta.color }}
                    />
                    {statusSelect(c, true)}
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      title={
                        (c.sourceDate ? `📅${fmtMd(c.sourceDate)} ` : "") +
                        c.text +
                        (c.note ? `\n📝 ${c.note}` : "") +
                        `\n［${meta.label}］タップで編集`
                      }
                      className={`min-w-0 flex-1 truncate text-left text-xs ${
                        isResolved ? "text-gray-400 line-through" : "text-ink/90"
                      }`}
                    >
                      {c.text}
                    </button>
                    {c.note && (
                      <span
                        className="shrink-0 text-[10px] text-gray-300"
                        title={c.note}
                        aria-label="メモあり"
                      >
                        📝
                      </span>
                    )}
                  </div>
                ) : (
                  /* ---- 詳細表示 ---- */
                  <>
                    <div className="flex items-start gap-2">
                      {statusSelect(c)}

                      <p
                        onClick={() => startEdit(c)}
                        title="タップで編集"
                        className={`flex-1 cursor-text whitespace-pre-wrap break-words text-sm ${
                          isResolved
                            ? "text-gray-400 line-through"
                            : "text-ink/90"
                        }`}
                      >
                        {c.text}
                      </p>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="px-1 text-gray-300 hover:text-navy"
                          aria-label="編集"
                          title="編集"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(c.id)}
                          className="px-1 text-gray-300 hover:text-accent"
                          aria-label="削除"
                          title="削除"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {c.note && (
                      <p className="mt-1.5 whitespace-pre-wrap break-words pl-1 text-xs text-gray-500">
                        {c.note}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCatFilter(c.category)}
                        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-navy"
                        title={`${meta.label}で絞り込み`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        {meta.label}
                      </button>
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
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-rule bg-white/50 px-4 py-8 text-center text-sm text-gray-400">
          {filtersOn
            ? "条件に一致する経営課題はありません。"
            : "まだ経営課題がありません。上の欄から追加できます。"}
        </p>
      )}

      {/* もっと見る */}
      {filtered.length > visible.length && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
            className="rounded-lg border border-rule bg-white px-4 py-2 text-sm text-navy shadow-sm hover:bg-gray-50"
          >
            もっと見る（残り {filtered.length - visible.length}件）
          </button>
        </div>
      )}
    </div>
  );
}
