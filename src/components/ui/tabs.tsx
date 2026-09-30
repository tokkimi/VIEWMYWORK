"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";

/** Link-based tabs (each tab is a URL — shareable and server-rendered). */
export function LinkTabs({ tabs, exact, className }: { tabs: { href: string; label: string; count?: number }[]; exact?: boolean; className?: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  const { t: tr } = useI18n();
  const nav = useRef<HTMLElement>(null);
  const full = sp.toString() ? `${path}?${sp.toString()}` : path;
  const isActive = (href: string) => {
    if (href.includes("?")) return full === href || (full.startsWith(href) && href !== path);
    if (exact) return path === href && !sp.toString();
    const siblings = tabs.map((t) => t.href).filter((h) => h !== href && h.startsWith(href) && !h.includes("?"));
    return path === href || (path.startsWith(href + "/") && !siblings.some((s) => path.startsWith(s)));
  };
  // Keep the current tab visible in the strip (phones) without moving the page.
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && nav.current) nav.current.scrollLeft = el.offsetLeft - (nav.current.clientWidth - el.offsetWidth) / 2;
  }, [path]);
  return (
    <nav ref={nav} className={cn("no-scrollbar relative -mx-4 mb-8 overflow-x-auto overflow-y-hidden border-b border-line px-4 sm:mx-0 sm:px-0", className)} aria-label="Sections">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const a = isActive(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={a ? "page" : undefined} className={cn("relative flex h-10 items-center gap-1.5 px-3 text-[13px] transition-colors", a ? "text-fg" : "text-muted hover:text-fg")}>
                {tr(t.label)}
                {t.count !== undefined && t.count > 0 && <span className="num rounded-full bg-white/[0.07] px-1.5 text-[10.5px] text-muted">{t.count}</span>}
                {a && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

