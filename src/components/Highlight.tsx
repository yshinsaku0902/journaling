// テキスト内の一致部分を <mark> で強調する。大文字小文字は区別しない。
import { Fragment } from "react";

export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const parts: { value: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push({ value: text.slice(i), match: false });
      break;
    }
    if (idx > i) parts.push({ value: text.slice(i, idx), match: false });
    parts.push({ value: text.slice(idx, idx + q.length), match: true });
    i = idx + q.length;
  }

  return (
    <>
      {parts.map((p, idx) =>
        p.match ? (
          <mark key={idx} className="rounded bg-accent/15 px-0.5 text-accent">
            {p.value}
          </mark>
        ) : (
          <Fragment key={idx}>{p.value}</Fragment>
        ),
      )}
    </>
  );
}
