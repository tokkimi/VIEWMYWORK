import { ExternalLink, Globe, Monitor, Smartphone } from "lucide-react";
import { Tr } from "@/lib/i18n/client";

type P = { url: string; label: string; embeddable: boolean | null; imageUrl: string | null; pageTitle: string | null };

/**
 * Miniature of a website at desktop (1280px) and mobile (390px) widths. The frames are real,
 * scaled-down iframes, so they scroll. Sites that forbid framing get a clean card instead.
 */
export function SitePreviewMini({ p }: { p: P }) {
  const domain = (() => { try { return new URL(p.url).hostname; } catch { return p.url; } })();
  if (p.embeddable === false)
    return (
      <a href={p.url} target="_blank" rel="noreferrer noopener" className="panel flex items-center gap-4 overflow-hidden rounded-2xl p-3 hover:border-line-strong">
        <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white/[0.03]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-full object-cover" /> : <Globe className="size-6 text-muted" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{p.pageTitle || p.label}</div>
          <div className="truncate text-xs text-muted">{domain}</div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-accent"><ExternalLink className="size-3.5" /><Tr>This site blocks embedding — open it in a new tab.</Tr></div>
        </div>
      </a>
    );
  const frame = "absolute left-0 top-0 origin-top-left border-0 bg-white";
  return (
    <div className="flex flex-wrap items-start gap-5">
      <figure className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl">
          <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-2.5 py-1.5">
            <span className="size-1.5 rounded-full bg-white/15" /><span className="size-1.5 rounded-full bg-white/15" /><span className="size-1.5 rounded-full bg-white/15" />
            <span className="ml-2 truncate text-[10px] text-subtle">{domain}</span>
          </div>
          {/* 1280×800 page rendered at 0.35 */}
          <div className="relative h-[280px] w-[448px] max-w-[calc(100vw-5rem)] overflow-hidden">
            <iframe src={p.url} title={`${p.label} — desktop`} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" className={frame} style={{ width: 1280, height: 800, transform: "scale(0.35)" }} />
          </div>
        </div>
        <figcaption className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle"><Monitor className="size-3.5" /><Tr>Desktop</Tr></figcaption>
      </figure>
      <figure>
        <div className="rounded-[26px] border border-line-strong bg-surface p-1.5 shadow-2xl">
          {/* 390×844 page rendered at 0.5 */}
          <div className="relative h-[422px] w-[195px] overflow-hidden rounded-[20px]">
            <iframe src={p.url} title={`${p.label} — mobile`} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" className={frame} style={{ width: 390, height: 844, transform: "scale(0.5)" }} />
          </div>
        </div>
        <figcaption className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle"><Smartphone className="size-3.5" /><Tr>Mobile</Tr></figcaption>
      </figure>
    </div>
  );
}
