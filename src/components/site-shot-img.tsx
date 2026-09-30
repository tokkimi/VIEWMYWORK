"use client";

import { useEffect, useRef, useState } from "react";
import { checkFramingAction } from "@/server/actions/previews";
import { ImageOff, Loader2 } from "lucide-react";
import { Tr } from "@/lib/i18n/client";

/**
 * Full-page screenshot of a website taken by our own server (headless browser, cached), shown in a
 * scrollable frame. Works for sites that refuse to be framed, http mockups and sites with a loader.
 */
export function SiteShotImg({ url, device, alt, className, style }: { url: string; device: "desktop" | "mobile"; alt: string; className?: string; style?: React.CSSProperties }) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const src = `/api/site-shot?d=${device}&url=${encodeURIComponent(url)}${attempt ? `&r=${attempt}` : ""}`;
  return (
    <div className={`no-scrollbar relative overflow-y-auto overscroll-contain bg-white ${className ?? ""}`} style={style}>
      {state === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-2 text-xs text-muted">
          <Loader2 className="size-5 animate-spin" />
          <Tr>Taking a screenshot…</Tr>
        </div>
      )}
      {state === "failed" ? (
        <a href={url} target="_blank" rel="noreferrer noopener" className="flex size-full flex-col items-center justify-center gap-2 bg-surface-2 p-4 text-center text-xs text-muted">
          <ImageOff className="size-5" />
          <Tr>Screenshot unavailable for this site.</Tr>
          <span className="text-accent"><Tr>Open the site</Tr></span>
        </a>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={attempt}
          src={src}
          alt={alt}
          className="block w-full text-transparent"
          onLoad={() => setState("ok")}
          onError={() => {
            // One retry (cold start of the screenshot browser), then give up cleanly.
            if (attempt < 1) timer.current = setTimeout(() => setAttempt((a) => a + 1), 1500);
            else setState("failed");
          }}
        />
      )}
    </div>
  );
}

/** When the framing verdict is unknown, ask the server once; if the site refuses frames, switch to screenshots. */
export function useFramingCheck(check: { kind: "project" | "preview"; id: string } | undefined, embeddable: boolean | null, onBlocked: () => void) {
  useEffect(() => {
    if (!check || embeddable !== null) return;
    let alive = true;
    checkFramingAction(check.kind, check.id).then((r) => { if (alive && r.ok && r.data?.embeddable === false) onBlocked(); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check?.kind, check?.id, embeddable]);
}
