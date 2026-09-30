"use client";

import { useEffect } from "react";

const KEY = "fmf-reloaded-at";

/** After a new deployment, stale pages fail to load their code: reload once to pick up the new version. */
export function useAutoRecover(error: Error) {
  useEffect(() => {
    const stale = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Failed to load|dpl|deployment/i.test(`${error?.name} ${error?.message}`);
    let last = 0;
    try { last = Number(sessionStorage.getItem(KEY) || 0); } catch {}
    if (stale && Date.now() - last > 30_000) {
      try { sessionStorage.setItem(KEY, String(Date.now())); } catch {}
      window.location.reload();
    }
  }, [error]);
}
