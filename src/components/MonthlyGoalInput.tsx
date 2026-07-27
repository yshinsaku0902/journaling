"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  ym: string;
  initialGoal: number | null;
  daysInMonth: number;
}

function numToInput(n: number | null): string {
  return n == null ? "" : String(n);
}

export function MonthlyGoalInput({ ym, initialGoal, daysInMonth }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(numToInput(initialGoal));
  const [saving, setSaving] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        const trimmed = value.trim();
        const distanceGoalKm = trimmed === "" ? null : Number(trimmed);
        const res = await fetch(`/api/goal/${ym}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ distanceGoalKm }),
        });
        if (res.ok) router.refresh(); // メダル・ペース表示を更新
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const parsed = Number(value);
  const pace =
    value.trim() !== "" && !Number.isNaN(parsed) && parsed > 0
      ? parsed / daysInMonth
      : null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <label htmlFor="monthly-goal" className="text-sm text-gray-600">
        🎯 今月の目標
      </label>
      <div className="flex items-baseline gap-1">
        <input
          id="monthly-goal"
          type="number"
          inputMode="decimal"
          step="1"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="—"
          className="w-20 rounded-lg border border-rule focus:border-navy bg-white px-2 py-1 text-right text-sm font-bold tabular-nums outline-none transition"
        />
        <span className="text-xs text-gray-400">km</span>
      </div>
      {pace != null && (
        <span className="text-xs text-gray-500 tabular-nums">
          （1日 {pace.toFixed(1)}km ペース）
        </span>
      )}
      {saving && <span className="text-xs text-gray-400">保存中…</span>}
    </div>
  );
}
