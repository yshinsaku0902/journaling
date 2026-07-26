"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {
          /* 登録失敗は無視（オフライン化は任意機能） */
        });
    }
  }, []);
  return null;
}
