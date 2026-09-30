"use client";

import { useState } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tr } from "@/lib/i18n/client";
import { SiteShotImg, useFramingCheck } from "@/components/site-shot-img";

type P = { url: string; label: string; embeddable: boolean | null; imageUrl: string | null; pageTitle: string | null };

/**
 * Miniature of a website at desktop (1280px) and mobile (390px) widths. "Live" uses real, scaled-down
 * iframes (they scroll); "Screenshot" works for every site, including those that forbid framing or
 * stay blank inside a frame. Sites known to block framing start on screenshots.
 */
export function SitePreviewMini({ p, check }: { p: P; check?: { kind: "project" | "preview"; id: string } }) {
  // An http:// page can never be shown live inside an https page (browsers block mixed content).
  const insecure = /^http:\/\//i.test(p.url);
  const [blocked, setBlocked] = useState(p.embeddable === false);
  const [mode, setMode] = useState<"live" | "shot">(blocked || insecure ? "shot" : "live");
  useFramingCheck(check, p.embeddable, () => { setBlocked(true); setMode("shot"); });
  const domain = (() => { try { return new URL(p.url).hostname; } catch { return p.url; } })();
  const frame = "absolute left-0 top-0 origin-top-left border-0 bg-white";
  const live = mode === "live";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-line p-0.5 text-xs" role="radiogroup">
          {!insecure && <button type="button" role="radio" aria-checked={live} onClick={() => setMode("live")} className={cn("rounded-md px-2.5 py-1", live ? "bg-white/[0.08] text-fg" : "text-muted")}><Tr>Live</Tr></button>}
          <button type="button" role="radio" aria-checked={!live} onClick={() => setMode("shot")} className={cn("rounded-md px-2.5 py-1", !live ? "bg-white/[0.08] text-fg" : "text-muted")}><Tr>Screenshot</Tr></button>
        </div>
        <a href={p.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"><ExternalLink className="size-3.5" /><Tr>Open the site</Tr></a>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <figure className="min-w-0 max-w-full">
          <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-2.5 py-1.5">
              <span className="size-1.5 rounded-full bg-white/15" /><span className="size-1.5 rounded-full bg-white/15" /><span className="size-1.5 rounded-full bg-white/15" />
              <span className="ml-2 truncate text-[10px] text-subtle">{domain}</span>
            </div>
            {/* 1280×800 page rendered at 0.35 */}
            <div className="relative h-[280px] w-[448px] max-w-full overflow-hidden bg-white">
              {live ? (
                <iframe src={p.url} title={`${p.label} — desktop`} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms" className={frame} style={{ width: 1280, height: 800, transform: "scale(0.35)" }} />
              ) : (
                <SiteShotImg url={p.url} device="desktop" alt={`${p.label} — desktop`} className="size-full" />
              )}
            </div>
          </div>
          <figcaption className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle"><Monitor className="size-3.5" /><Tr>Desktop</Tr></figcaption>
        </figure>
        <figure>
          <div className="rounded-[26px] border border-line-strong bg-surface p-1.5 shadow-2xl">
            {/* 390×844 page rendered at 0.5 */}
            <div className="relative h-[422px] w-[195px] overflow-hidden rounded-[20px] bg-white">
              {live ? (
                <iframe src={p.url} title={`${p.label} — mobile`} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms" className={frame} style={{ width: 390, height: 844, transform: "scale(0.5)" }} />
              ) : (
                <SiteShotImg url={p.url} device="mobile" alt={`${p.label} — mobile`} className="size-full" />
              )}
            </div>
          </div>
          <figcaption className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle"><Smartphone className="size-3.5" /><Tr>Mobile</Tr></figcaption>
        </figure>
      </div>
      <p className="text-[11px] text-subtle">{insecure ? <Tr>Non-secure site (http): browsers only allow a screenshot here.</Tr> : blocked ? <Tr>This site refuses to be displayed inside another page, so a screenshot is shown. You can still try Live.</Tr> : <Tr>Blank frame? Some sites refuse to be displayed inside another page — switch to Screenshot.</Tr>}</p>
    </div>
  );
}
