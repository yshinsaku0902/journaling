// 月別走行距離の棒グラフ（依存ライブラリなし・純粋なサーバーコンポーネント）。
// monthly は長さ12（1月〜12月）の km 配列。

function fmtKm(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function DistanceBarChart({ monthly }: { monthly: number[] }) {
  const max = Math.max(0, ...monthly);

  if (max <= 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-500">
        この年の走行距離の記録はまだありません。
      </p>
    );
  }

  return (
    <div>
      <div className="flex h-48 items-end gap-1.5">
        {monthly.map((v, i) => (
          <div
            key={i}
            className="flex h-full flex-1 items-end"
            title={`${i + 1}月: ${fmtKm(v)} km`}
          >
            <div
              className="w-full rounded-t bg-navy/80"
              style={{ height: `${(v / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {monthly.map((v, i) => (
          <div key={i} className="flex-1 text-center">
            <div className="text-[10px] text-gray-500">{i + 1}</div>
            {v > 0 && (
              <div className="text-[9px] font-medium text-navy tabular-nums">
                {fmtKm(v)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
