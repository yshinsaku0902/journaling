// 経営課題（Challenge）のドメイン型・定数と、フレームワーク非依存の集計ヘルパー。
// search.ts / stats.ts と同様、この機能に必要な型とロジックをこの1ファイルに集約する。

// 進捗ステータス: 未着手 / 対応中 / 解決
export type ChallengeStatus = "open" | "doing" | "resolved";

// カテゴリは固定リスト（表示ラベル＋ダッシュボード用の色）。
export const CHALLENGE_CATEGORIES = [
  { key: "people", label: "人材・組織", color: "#2563eb" },
  { key: "finance", label: "財務・数値", color: "#059669" },
  { key: "sales", label: "営業・マーケ", color: "#d97706" },
  { key: "product", label: "商品・サービス", color: "#7c3aed" },
  { key: "customer", label: "顧客・取引先", color: "#db2777" },
  { key: "ops", label: "業務・仕組み", color: "#0891b2" },
  { key: "other", label: "その他", color: "#6b7280" },
] as const;

export type ChallengeCategory = (typeof CHALLENGE_CATEGORIES)[number]["key"];

export const CHALLENGE_STATUS = {
  open: { label: "未着手", color: "#b91c1c" },
  doing: { label: "対応中", color: "#d97706" },
  resolved: { label: "解決", color: "#059669" },
} as const satisfies Record<ChallengeStatus, { label: string; color: string }>;

// ステータスを順に切り替えるときの遷移（カード上のワンタップ用）。
export const NEXT_STATUS: Record<ChallengeStatus, ChallengeStatus> = {
  open: "doing",
  doing: "resolved",
  resolved: "open",
};

// 1件の経営課題。
export interface Challenge {
  id: string;
  text: string; // 課題の内容
  category: ChallengeCategory;
  status: ChallengeStatus;
  note: string; // 補足メモ（任意）
  sourceDate: string | null; // 元の日記日付 yyyy-MM-dd（トップから追加時は null）
  createdAt: string; // ISO
  updatedAt: string; // ISO
  resolvedAt: string | null; // 解決にした時刻（履歴・振り返り用）
}

// 登録時のペイロード（id/日時などはサーバで付与）。
export type ChallengeInput = Pick<Challenge, "text" | "category"> &
  Partial<Pick<Challenge, "note" | "sourceDate">>;

// 更新時のペイロード（部分更新）。
export type ChallengePatch = Partial<
  Pick<Challenge, "text" | "category" | "status" | "note">
>;

// カテゴリのメタ情報を引く（未知キーは「その他」にフォールバック）。
export function categoryMeta(key: string): (typeof CHALLENGE_CATEGORIES)[number] {
  return (
    CHALLENGE_CATEGORIES.find((c) => c.key === key) ??
    CHALLENGE_CATEGORIES[CHALLENGE_CATEGORIES.length - 1]
  );
}

// トップのダッシュボード用の集計結果。
export interface ChallengeSummary {
  byCategory: {
    key: ChallengeCategory;
    label: string;
    color: string;
    open: number; // 未解決（未着手＋対応中）の件数
  }[];
  statusCounts: Record<ChallengeStatus, number>;
  unresolved: Challenge[]; // open + doing（未着手→対応中の順、同ステータス内は更新の新しい順）
  resolved: Challenge[]; // resolved（解決の新しい順・履歴表示用）
}

const STATUS_RANK: Record<ChallengeStatus, number> = {
  open: 0,
  doing: 1,
  resolved: 2,
};

// 課題リストからダッシュボード表示に必要な集計を作る純粋関数。
export function summarizeChallenges(list: Challenge[]): ChallengeSummary {
  const statusCounts: Record<ChallengeStatus, number> = {
    open: 0,
    doing: 0,
    resolved: 0,
  };
  for (const c of list) statusCounts[c.status] += 1;

  const unresolved = list
    .filter((c) => c.status === "open" || c.status === "doing")
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.updatedAt.localeCompare(a.updatedAt),
    );

  const resolved = list
    .filter((c) => c.status === "resolved")
    .sort((a, b) =>
      (b.resolvedAt ?? b.updatedAt).localeCompare(a.resolvedAt ?? a.updatedAt),
    );

  const openByCat = new Map<ChallengeCategory, number>();
  for (const c of unresolved) {
    openByCat.set(c.category, (openByCat.get(c.category) ?? 0) + 1);
  }

  const byCategory = CHALLENGE_CATEGORIES.map((cat) => ({
    key: cat.key,
    label: cat.label,
    color: cat.color,
    open: openByCat.get(cat.key) ?? 0,
  }));

  return { byCategory, statusCounts, unresolved, resolved };
}
