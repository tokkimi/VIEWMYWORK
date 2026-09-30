"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Home, FolderKanban, Files, Receipt, MessageSquare, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { NotificationBell } from "@/components/app/topbar";
import { Avatar } from "@/components/ui/primitives";
import { logoutAction } from "@/server/actions/auth";
import { switchPortalClientAction } from "@/server/actions/workspace";
import { Tr, useI18n } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";

export function PortalNav({ brand, projects, clients, currentClientId, userName }: { brand: { name: string; logoUrl: string | null }; projects: { id: string; name: string }[]; clients: { id: string; name: string }[]; currentClientId: string; userName: string }) {
  const { t } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const single = projects.length === 1 ? projects[0] : null;
  const items = [
    { href: "/portal", label: "Overview", icon: Home, exact: true },
    { href: single ? `/portal/projects/${single.id}/plan` : "/portal/projects", label: "Project", icon: FolderKanban },
    { href: "/portal/files", label: "Files", icon: Files },
    { href: "/portal/invoices", label: "Invoices", icon: Receipt },
    { href: "/portal/messages", label: "Messages", icon: MessageSquare },
  ];
  const active = (href: string, exact?: boolean) => (exact ? path === href : path.startsWith(href.replace(/\/plan$/, "")) && !(href === "/portal" && path !== "/portal"));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.name} className="h-7 max-w-[140px] object-contain" /> : <span className="truncate text-[15px] font-semibold">{brand.name}</span>}
          </Link>
          <nav className="ml-6 hidden items-center gap-1 sm:flex" aria-label={t("Portal")}>
            {items.map((i) => (
              <Link key={i.label} href={i.href} aria-current={active(i.href, i.exact) ? "page" : undefined} className={cn("rounded-lg px-3 py-1.5 text-sm", active(i.href, i.exact) ? "bg-white/[0.07] text-fg" : "text-muted hover:text-fg")}>{t(i.label)}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell base="/portal" />
            <div className="relative">
              <button onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} className="flex items-center gap-1.5 rounded-lg p-1 hover:bg-white/[0.05]" aria-label={t("Account menu")}>
                <Avatar name={userName} size={28} /><ChevronDown className="hidden size-3.5 text-subtle sm:block" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-line bg-surface-2 p-1 shadow-2xl">
                    <div className="px-2.5 py-2 text-xs text-muted">{userName}</div>
                    {clients.length > 1 && clients.map((c) => (
                      <button key={c.id} role="menuitem" onClick={async () => { setMenu(false); const r = await switchPortalClientAction(c.id); if (r.ok) { router.push("/portal"); router.refresh(); } }} className={cn("flex w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/[0.05]", c.id === currentClientId && "text-accent")}>{c.name}</button>
                    ))}
                    <div className="px-2.5 py-2"><LanguageSwitcher /></div>
                    <form action={logoutAction}><button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/[0.05]"><LogOut className="size-3.5" /><Tr>Sign out</Tr></button></form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      {/* Mobile: thumb-friendly bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden" aria-label={t("Portal")}>
        <ul className="grid grid-cols-5">
          {items.map((i) => (
            <li key={i.label}>
              <Link href={i.href} aria-current={active(i.href, i.exact) ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[10.5px]", active(i.href, i.exact) ? "text-accent" : "text-muted")}>
                <i.icon className="size-5" />{t(i.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
