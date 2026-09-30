"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, FolderKanban, Receipt, MessageSquare, LogOut, ChevronDown, MessageSquareDiff, CalendarRange, Package, Files, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { NotificationBell } from "@/components/app/topbar";
import { Avatar } from "@/components/ui/primitives";
import { logoutAction } from "@/server/actions/auth";
import { switchPortalClientAction } from "@/server/actions/workspace";
import { Tr, useI18n } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";

type P = { id: string; name: string };

/** Sections of a project, shown when the "Project" menu is opened (no second row of tabs). */
const SECTIONS = [
  { seg: "", label: "Overview", icon: Home },
  { seg: "/plan", label: "Project plan", icon: CalendarRange },
  { seg: "/deliverables", label: "Deliverables", icon: Package },
  { seg: "/files", label: "Files", icon: Files },
  { seg: "/requests", label: "Change requests", icon: MessageSquareDiff },
  { seg: "/messages", label: "Messages", icon: MessageSquare },
] as const;

export function PortalNav({ brand, projects, clients, currentClientId, userName }: { brand: { name: string; logoUrl: string | null }; projects: P[]; clients: { id: string; name: string }[]; currentClientId: string; userName: string }) {
  const { t } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [projectMenu, setProjectMenu] = useState(false);
  useEffect(() => { setProjectMenu(false); setMenu(false); }, [path]);

  const inProject = path.match(/^\/portal\/projects\/([0-9a-f-]{36})/)?.[1];
  const current = projects.find((p) => p.id === inProject) ?? (projects.length === 1 ? projects[0] : undefined);
  const base = current ? `/portal/projects/${current.id}` : null;
  const sectionActive = (seg: string) => base !== null && (seg === "" ? path === base : path.startsWith(base + seg));
  const projectActive = path.startsWith("/portal/projects") || path === "/portal/files" || path === "/portal/messages";
  const top = "rounded-lg px-3 py-1.5 text-sm";

  const mobile = base
    ? [
        { href: "/portal", label: "Home", icon: Home, on: path === "/portal" },
        { href: `${base}/plan`, label: "Schedule", icon: CalendarRange, on: sectionActive("/plan") || sectionActive("") },
        { href: `${base}/requests`, label: "Requests", icon: MessageSquareDiff, on: sectionActive("/requests") },
        { href: `${base}/messages`, label: "Messages", icon: MessageSquare, on: sectionActive("/messages") },
        { href: "/portal/invoices", label: "Invoices", icon: Receipt, on: path.startsWith("/portal/invoices") },
      ]
    : [
        { href: "/portal", label: "Home", icon: Home, on: path === "/portal" },
        { href: "/portal/projects", label: "Projects", icon: FolderKanban, on: projectActive },
        { href: "/portal/invoices", label: "Invoices", icon: Receipt, on: path.startsWith("/portal/invoices") },
      ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.name} className="h-7 max-w-[140px] object-contain" /> : <span className="truncate text-[15px] font-semibold">{brand.name}</span>}
          </Link>
          <nav className="ml-6 hidden items-center gap-1 sm:flex" aria-label={t("Portal")}>
            <Link href="/portal" aria-current={path === "/portal" ? "page" : undefined} className={cn(top, path === "/portal" ? "bg-white/[0.07] text-fg" : "text-muted hover:text-fg")}><Tr>Overview</Tr></Link>
            <div className="relative">
              <button onClick={() => setProjectMenu(!projectMenu)} aria-haspopup="menu" aria-expanded={projectMenu} className={cn(top, "flex items-center gap-1", projectActive ? "bg-white/[0.07] text-fg" : "text-muted hover:text-fg")}>
                {projects.length > 1 ? <Tr>Projects</Tr> : <Tr>Project</Tr>}<ChevronDown className={cn("size-3.5 transition-transform", projectMenu && "rotate-180")} />
              </button>
              {projectMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProjectMenu(false)} />
                  <div role="menu" className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-line bg-surface-2 p-1 shadow-2xl">
                    {projects.length > 1 && (
                      <div className="border-b border-line pb-1">
                        {projects.map((p) => (
                          <Link key={p.id} role="menuitem" href={`/portal/projects/${p.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-white/[0.05]">
                            <span className="truncate">{p.name}</span>{current?.id === p.id && <Check className="size-3.5 text-accent" />}
                          </Link>
                        ))}
                      </div>
                    )}
                    {base ? (
                      <div className={cn(projects.length > 1 && "pt-1")}>
                        {projects.length > 1 && <div className="px-2.5 pb-1 pt-1.5 text-[11px] uppercase tracking-wide text-subtle">{current!.name}</div>}
                        {SECTIONS.map((s) => (
                          <Link key={s.seg} role="menuitem" href={base + s.seg} aria-current={sectionActive(s.seg) ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-white/[0.05]", sectionActive(s.seg) && "text-accent")}>
                            <s.icon className="size-4 text-muted" /><Tr>{s.label}</Tr>
                          </Link>
                        ))}
                      </div>
                    ) : projects.length === 0 ? (
                      <p className="px-2.5 py-2 text-sm text-subtle"><Tr>No projects shared yet</Tr></p>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            <Link href="/portal/invoices" aria-current={path.startsWith("/portal/invoices") ? "page" : undefined} className={cn(top, path.startsWith("/portal/invoices") ? "bg-white/[0.07] text-fg" : "text-muted hover:text-fg")}><Tr>Invoices</Tr></Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
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
        <ul className="flex">
          {mobile.map((i) => (
            <li key={i.href} className="flex-1">
              <Link href={i.href} aria-current={i.on ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[10.5px]", i.on ? "text-accent" : "text-muted")}>
                <i.icon className="size-5" /><Tr>{i.label}</Tr>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
