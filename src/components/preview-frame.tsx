"use client";

import { useState } from "react";
import { Monitor, Tablet, Smartphone, ExternalLink, Globe } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";

export type PreviewDTO = { id: string; label: string; url: string; type: string; embeddable: boolean | null; pageTitle: string | null; imageUrl: string | null };

const devices = [
  { k: "desktop", icon: Monitor, w: "100%", h: 640, label: "Desktop" },
  { k: "tablet", icon: Tablet, w: "820px", h: 700, label: "Tablet" },
  { k: "mobile", icon: Smartphone, w: "390px", h: 720, label: "Mobile" },
] as const;

/** Device-framed live preview. When a site forbids framing we never show a broken iframe — we show a clean fallback card. */
export function PreviewFrame({ p }: { p: PreviewDTO }) {
  const [device, setDevice] = useState<(typeof devices)[number]["k"]>(p.type === "MOBILE_APP" ? "mobile" : "desktop");
  const d = devices.find((x) => x.k === device)!;
  const domain = (() => { try { return new URL(p.url).hostname; } catch { return p.url; } })();

  if (!p.embeddable)
    return (
      <div className="panel overflow-hidden rounded-2xl">
        <div className="relative aspect-[16/9] max-h-[420px] w-full overflow-hidden border-b border-line bg-white/[0.02]">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 text-muted"><Globe className="size-8" /><span className="text-sm">{domain}</span></div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{p.pageTitle || p.label}</div>
            <div className="truncate text-xs text-muted">{domain}</div>
          </div>
          <a href={p.url} target="_blank" rel="noreferrer noopener" className={buttonClass("primary", "sm")}><ExternalLink className="size-3.5" />Open preview</a>
        </div>
      </div>
    );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Device">
          {devices.map((x) => (
            <button key={x.k} role="radio" aria-checked={device === x.k} aria-label={x.label} onClick={() => setDevice(x.k)} className={cn("rounded-md p-1.5", device === x.k ? "bg-white/[0.08] text-fg" : "text-muted")}><x.icon className="size-4" /></button>
          ))}
        </div>
        <a href={p.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 text-xs text-muted hover:text-fg"><ExternalLink className="size-3.5" />Open in new tab</a>
      </div>
      <div className="flex justify-center overflow-x-auto rounded-2xl border border-line bg-white/[0.015] p-4 sm:p-6">
        <div className={cn("overflow-hidden border border-line-strong bg-surface shadow-2xl transition-all duration-300", device === "mobile" ? "rounded-[36px] p-2.5" : device === "tablet" ? "rounded-[24px] p-2.5" : "rounded-xl")} style={{ width: d.w, maxWidth: "100%" }}>
          {device === "desktop" && (
            <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
              <span className="size-2 rounded-full bg-white/15" /><span className="size-2 rounded-full bg-white/15" /><span className="size-2 rounded-full bg-white/15" />
              <span className="ml-3 flex-1 truncate rounded bg-white/[0.05] px-2 py-0.5 text-center text-[11px] text-subtle">{domain}</span>
            </div>
          )}
          <iframe src={p.url} title={p.label} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" className={cn("block w-full bg-white", device !== "desktop" && "rounded-[26px]")} style={{ height: d.h }} />
        </div>
      </div>
    </div>
  );
}
