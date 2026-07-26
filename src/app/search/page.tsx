import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { searchEntries } from "@/lib/store";
import { SignInPrompt } from "@/components/SignInPrompt";
import { SearchBox } from "@/components/SearchBox";
import { Highlight } from "@/components/Highlight";
import { jpDateParts } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <SignInPrompt />;

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const results = q ? await searchEntries(user.id, q) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-navy hover:underline">
          ← カレンダー
        </Link>
        <span className="text-xs text-gray-500">{user.name}</span>
      </header>

      <div className="mt-3">
        <SearchBox defaultValue={q} />
      </div>

      {!q ? (
        <p className="mt-8 text-center text-sm text-gray-500">
          キーワードを入力して過去の記入を検索できます。
        </p>
      ) : results.length === 0 ? (
        <p className="mt-8 text-center text-sm text-gray-500">
          「{q}」に一致する記入は見つかりませんでした。
        </p>
      ) : (
        <>
          <p className="mt-5 text-xs text-gray-500">
            「{q}」の検索結果 {results.length}件
          </p>
          <ul className="mt-3 space-y-3">
            {results.map((r) => {
              const { year, month, day, weekday } = jpDateParts(r.date);
              return (
                <li
                  key={r.date}
                  className="bg-white rounded-2xl shadow-sm border border-rule p-4"
                >
                  <Link
                    href={`/journal/${r.date}`}
                    className="font-bold text-navy hover:underline"
                  >
                    {year}年{month}月{day}日（{weekday}）
                  </Link>
                  <div className="mt-2 space-y-2">
                    {r.hits.map((h, i) => (
                      <div key={i} className="text-sm">
                        <span className="mr-2 inline-block rounded bg-navy/5 px-1.5 py-0.5 text-xs text-navy">
                          {h.label}
                        </span>
                        <span className="text-ink/80">
                          <Highlight text={h.snippet} query={q} />
                        </span>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
