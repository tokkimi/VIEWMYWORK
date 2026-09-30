"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a page in sync with the other side (professional ⇄ client): polls a small fingerprint and
 * refreshes the server-rendered content when it changes. Paused while the tab is hidden.
 */
export function LiveSync({ project, every = 8000 }: { project?: string; every?: number }) {
  const router = useRouter();
  const last = useRef<string | null>(null);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!document.hidden) {
        try {
          const r = await fetch(`/api/live${project ? `?p=${project}` : ""}`, { cache: "no-store" });
          if (r.ok) {
            const { s } = (await r.json()) as { s: string };
            // Don't refresh under someone who is typing: wait for the next tick.
            const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
            if (last.current && s !== last.current && !typing) router.refresh();
            if (!typing || !last.current) last.current = s;
          }
        } catch {}
      }
      if (!stop) timer = setTimeout(tick, every);
    };
    tick();
    const onVisible = () => { if (!document.hidden) { clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stop = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [project, every, router]);
  return null;
}
