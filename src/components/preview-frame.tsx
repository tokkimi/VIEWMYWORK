"use client";

import { useState } from "react";
import { Monitor, Tablet, Smartphone, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { siteShot } from "@/lib/site-shot";
import { useI18n } from "@/lib/i18n/client";

export type PreviewDTO = { id: string; label: string; url: string; type: string; embeddable: boolean | null; pageTitle: string | null; imageUrl: string | null };

const devices = [
  { k: "desktop", icon: Monitor, w: "100%", px: 1280, h: 640, label: "Desktop" },
  { k: "tablet", icon: Tablet, w: "820px", px: 820, h: 700, label: "Tablet" },
  { k: "mobile", icon: Smartphone, w: "390px", px: 390, h: 720, label: "Mobile" },
] as const;

/** Device-framed live preview. When a site forbids framing we never show a broken iframe — we show screenshots instead. */
export function PreviewFrame({ p }: { p: PreviewDTO }) {
  const { t } = useI18n();
  const [device, setDevice] = useState<(typeof devices)[number]["k"]>(p.type === "MOBILE_APP" ? "mobile" : "desktop");
  const d = devices.find((x) => x.k === device)!;
  const domain = (() => { try { return new URL(p.url).hostname; } catch { return p.url; } })();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={t("Device")}>
          {devices.map((x) => (
            <button key={x.k} role="radio" aria-checked={device === x.k} aria-label={t(x.label)} onClick={() => setDevice(x.k)} className={cn("rounded-md p-1.5", device === x.k ? "bg-white/[0.08] text-fg" : "text-muted")}><x.icon className="size-4" /></button>
          ))}
        </div>
        <a href={p.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 text-xs text-muted hover:text-fg"><ExternalLink className="size-3.5" />{t("Open in new tab")}</a>
      </div>
      <div className="flex justify-center overflow-x-auto rounded-2xl border border-line bg-white/[0.015] p-4 sm:p-6">
        <div className={cn("overflow-hidden border border-line-strong bg-surface shadow-2xl transition-all duration-300", device === "mobile" ? "rounded-[36px] p-2.5" : device === "tablet" ? "rounded-[24px] p-2.5" : "rounded-xl")} style={{ width: d.w, maxWidth: "100%" }}>
          {device === "desktop" && (
            <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
              <span className="size-2 rounded-full bg-white/15" /><span className="size-2 rounded-full bg-white/15" /><span className="size-2 rounded-full bg-white/15" />
              <span className="ml-3 flex-1 truncate rounded bg-white/[0.05] px-2 py-0.5 text-center text-[11px] text-subtle">{domain}</span>
            </div>
          )}
          {p.embeddable === false ? (
            // The site forbids framing: show a screenshot at the selected device size instead.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={siteShot(p.url, d.px, device === "desktop" ? 800 : d.h)} alt={p.pageTitle || p.label} loading="lazy" referrerPolicy="no-referrer" className={cn("block w-full bg-white object-cover object-top", device !== "desktop" && "rounded-[26px]")} style={device === "desktop" ? { aspectRatio: "1280 / 800" } : { height: d.h }} />
          ) : (
          <iframe src={p.url} title={p.label} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" className={cn("block w-full bg-white", device !== "desktop" && "rounded-[26px]")} style={{ height: d.h }} />
          )}
        </div>
      </div>
      {p.embeddable === false && <p className="mt-2 text-xs text-muted">{t("This site blocks live embedding — screenshots shown. Open the site")}</p>}
    </div>
  );
}
