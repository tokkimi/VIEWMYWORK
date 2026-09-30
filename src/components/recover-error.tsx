"use client";

import { useEffect } from "react";

const KEY = "fmf-reloaded-at";

/**
 * Page transitions can fail for transient reasons: a new deployment (stale code chunks) or a
 * momentary server/database hiccup. Reload the page once — at most every 30s per page — before
 * showing the error screen. Permission and not-found errors are never retried.
 */
export function useAutoRecover(error: Error) {
  useEffect(() => {
    if (/permission|not found|can't access/i.test(error?.message ?? "")) return;
    const key = `${KEY}:${window.location.pathname}`;
    let last = 0;
    try { last = Number(sessionStorage.getItem(key) || 0); } catch {}
    if (Date.now() - last > 30_000) {
      try { sessionStorage.setItem(key, String(Date.now())); } catch {}
      window.location.reload();
    }
  }, [error]);
}
