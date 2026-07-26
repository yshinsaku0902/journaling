// ジャーナル検索の共有ロジック。
// マッチ判定とスニペット生成をここに1本化し、pg / file 両バックエンドで挙動を揃える。
import type { JournalEntry } from "./types";

export interface SearchHit {
  field: string; // ヒットしたフィールドのキー
  label: string; // 表示用ラベル（例:「最重点目標」）
  snippet: string; // 一致箇所の抜粋
}

export interface SearchResult {
  date: string; // yyyy-MM-dd
  hits: SearchHit[];
}

// 検索対象は自由記述の3列のみ（箇条書き・時間軸は対象外）。
const SEARCH_FIELDS: { key: keyof JournalEntry; label: string }[] = [
  { key: "mostImportantGoal", label: "最重点目標" },
  { key: "dailyQuote", label: "名言" },
  { key: "memo", label: "MEMO" },
];

// 1エントリ内のヒットを列挙する。query が空なら空配列。
export function searchInEntry(entry: JournalEntry, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const { key, label } of SEARCH_FIELDS) {
    const text = (entry[key] as string) ?? "";
    if (text.toLowerCase().includes(q)) {
      hits.push({ field: key as string, label, snippet: makeSnippet(text, query) });
    }
  }
  return hits;
}

// 一致位置の前後を切り出したスニペットを作る。短い本文はそのまま返す。
export function makeSnippet(text: string, query: string, pad = 40): string {
  const q = query.trim();
  if (!q) return text;

  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1 || text.length <= pad * 2 + q.length) return text;

  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + q.length + pad);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}
