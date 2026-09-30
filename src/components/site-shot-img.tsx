"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { siteShot } from "@/lib/site-shot";
import { Tr } from "@/lib/i18n/client";

/**
 * Screenshot of a website. The screenshot service first answers with a small "generating" placeholder
 * and only has the real capture a few seconds later, so we retry until the real image arrives.
 */
export function SiteShotImg({ url, w, h, alt, className, style }: { url: string; w: number; h: number; alt: string; className?: string; style?: React.CSSProperties }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const src = `${siteShot(url, w, h)}${attempt ? `&r=${attempt}` : ""}`;
  const retry = () => {
    if (attempt >= 8) return setFailed(true);
    timer.current = setTimeout(() => setAttempt((a) => a + 1), 2500 + attempt * 1500);
  };
  if (failed)
    return (
      <a href={url} target="_blank" rel="noreferrer noopener" className={`flex flex-col items-center justify-center gap-2 bg-surface-2 p-4 text-center text-xs text-muted ${className ?? ""}`} style={style}>
        <ImageOff className="size-5" />
        <Tr>Screenshot unavailable for this site.</Tr>
        <span className="text-accent"><Tr>Open the site</Tr></span>
      </a>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`text-transparent ${className ?? ""}`}
      style={style}
      onLoad={(e) => { const i = e.currentTarget; if (Math.abs(i.naturalWidth - w) > 2 || Math.abs(i.naturalHeight - h) > 2) retry(); }}
      onError={retry}
    />
  );
}
