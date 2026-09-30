"use client";

import { useEffect, useRef, useState } from "react";
import { siteShot } from "@/lib/site-shot";

/**
 * Screenshot of a website. The screenshot service first answers with a small "generating" placeholder
 * and only has the real capture a few seconds later, so we retry until the real image arrives.
 */
export function SiteShotImg({ url, w, h, alt, className, style }: { url: string; w: number; h: number; alt: string; className?: string; style?: React.CSSProperties }) {
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const src = `${siteShot(url, w, h)}${attempt ? `&r=${attempt}` : ""}`;
  const retry = () => {
    if (attempt >= 8) return;
    timer.current = setTimeout(() => setAttempt((a) => a + 1), 2500 + attempt * 1500);
  };
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
