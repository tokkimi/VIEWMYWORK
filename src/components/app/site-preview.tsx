import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { Tr } from "@/lib/i18n/client";

type P = { url: string; label: string; embeddable: boolean | null; imageUrl: string | null; pageTitle: string | null };

/**
 * Miniature of a website at desktop (1280px) and mobile (390px) widths. The frames are real,
 * scaled-down iframes, so they scroll. Sites that forbid framing get screenshots instead.
 */
export function SitePreviewMini({ p }: { p: P }) {
  const domain = (() => { try { return new URL(p.url).hostname; } catch { return p.url; } })();
  if (p.embeddable === false) return <SiteShots url={p.url} label={p.label} domain={domain} />;
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

/** Screenshot service for sites that refuse to be framed (X-Frame-Options / CSP frame-ancestors). */
const shot = (url: string, w: number, h: number) => `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=${w}&h=${h}&vpw=${w}&vph=${h}`;

function SiteShots({ url, label, domain }: { url: string; label: string; domain: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-5">
        <figure className="min-w-0">
          <a href={url} target="_blank" rel="noreferrer noopener" className="block overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-2.5 py-1.5">
              <span className="size-1.5 rounded-full bg-white/15" /><span className="size-1.5 rounded-full bg-white/15" /><span className="size-1.5 rounded-full bg-white/15" />
              <span className="ml-2 truncate text-[10px] text-subtle">{domain}</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot(url, 1280, 800)} alt={`${label} — desktop`} loading="lazy" referrerPolicy="no-referrer" className="h-[280px] w-[448px] max-w-[calc(100vw-5rem)] bg-white object-cover object-top" />
          </a>
          <figcaption className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle"><Monitor className="size-3.5" /><Tr>Desktop</Tr></figcaption>
        </figure>
        <figure>
          <a href={url} target="_blank" rel="noreferrer noopener" className="block rounded-[26px] border border-line-strong bg-surface p-1.5 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot(url, 390, 844)} alt={`${label} — mobile`} loading="lazy" referrerPolicy="no-referrer" className="h-[422px] w-[195px] rounded-[20px] bg-white object-cover object-top" />
          </a>
          <figcaption className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle"><Smartphone className="size-3.5" /><Tr>Mobile</Tr></figcaption>
        </figure>
      </div>
      <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"><ExternalLink className="size-3.5" /><Tr>This site blocks live embedding — screenshots shown. Open the site</Tr></a>
    </div>
  );
}
