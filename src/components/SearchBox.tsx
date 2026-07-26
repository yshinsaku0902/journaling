// 記入を検索するためのボックス。GET フォームで /search に遷移する（クライアントJS不要）。
export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" method="get" role="search" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="記入を検索…"
        aria-label="記入を検索"
        className="flex-1 rounded-lg border border-rule bg-white px-3 py-2 text-sm outline-none focus:border-navy"
      />
      <button
        type="submit"
        className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
      >
        検索
      </button>
    </form>
  );
}
