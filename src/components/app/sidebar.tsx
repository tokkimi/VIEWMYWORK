"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid, FolderKanban, Users, CheckSquare, CalendarDays, Files, Receipt, LineChart, UsersRound, Bell, Settings, UserCircle, Menu, X, Shield, CreditCard, Activity, Gauge, Hourglass, FileBarChart } from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/logo";
import { WorkspaceSwitcher } from "./workspace-switcher";

import { useI18n } from "@/lib/i18n/client";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; show?: boolean };

export function Sidebar({ workspaces, current, can, isSuperAdmin, unread }: { workspaces: { id: string; name: string }[]; current: { id: string; name: string; logoUrl?: string | null }; can: { finance: boolean; invoices: boolean; clients: boolean; team: boolean; settings: boolean; billing: boolean; workload?: boolean }; isSuperAdmin: boolean; unread: number }) {
  const { t } = useI18n();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const main: Item[] = [
    { href: "/app", label: "Overview", icon: LayoutGrid },
    { href: "/app/projects", label: "Projects", icon: FolderKanban },
    { href: "/app/health", label: "Project health", icon: Activity },
    { href: "/app/clients", label: "Clients", icon: Users, show: can.clients },
    { href: "/app/decisions", label: "Client decisions", icon: Hourglass },
    { href: "/app/reports", label: "Weekly reports", icon: FileBarChart },
    { href: "/app/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/app/workload", label: "Team workload", icon: Gauge, show: can.workload },
    { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/app/files", label: "Files", icon: Files },
    { href: "/app/invoices", label: "Invoices", icon: Receipt, show: can.invoices },
    { href: "/app/finance", label: "Finance", icon: LineChart, show: can.finance },
    { href: "/app/team", label: "Team", icon: UsersRound, show: can.team },
    { href: "/app/notifications", label: "Notifications", icon: Bell },
  ];
  const bottom: Item[] = [
    { href: "/app/settings/billing", label: "Subscription", icon: CreditCard, show: can.billing },
    { href: "/app/settings", label: "Settings", icon: Settings, show: can.settings },
    { href: "/app/profile", label: "Profile", icon: UserCircle },
    ...(isSuperAdmin ? [{ href: "/admin", label: "Platform admin", icon: Shield }] : []),
  ];
  const active = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

  const nav = (
    <nav aria-label={t("App")} className="flex h-full flex-col">
      <div className="px-3 pb-3 pt-4">
        <WorkspaceSwitcher workspaces={workspaces} current={current} />
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {main.filter((i) => i.show !== false).map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={active(i.href) ? "page" : undefined} className={cn("group flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[13.5px] transition-colors", active(i.href) ? "bg-white/[0.07] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg")}>
              <i.icon className={cn("size-[17px]", active(i.href) ? "text-accent" : "text-subtle group-hover:text-muted")} />
              <span className="flex-1">{t(i.label)}</span>
              {i.href === "/app/notifications" && unread > 0 && <span className="num rounded-full bg-accent px-1.5 text-[10.5px] font-medium text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="space-y-0.5 border-t border-line px-3 py-3">
        {bottom.filter((i) => i.show !== false).map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={active(i.href) ? "page" : undefined} className={cn("flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[13.5px]", active(i.href) ? "bg-white/[0.07] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg")}>
              <i.icon className="size-[17px] text-subtle" />
              {t(i.label)}
            </Link>
          </li>
        ))}

      </ul>
    </nav>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-line bg-surface/60 backdrop-blur-xl lg:block">{nav}</aside>
      <button aria-label={t("Open navigation")} onClick={() => setOpen(true)} className="fixed left-3 top-3 z-40 flex size-9 items-center justify-center rounded-lg border border-line bg-surface lg:hidden">
        <Menu className="size-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("Navigation")}>
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[260px] border-r border-line bg-surface">
            <button aria-label={t("Close navigation")} onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-md p-1 text-muted"><X className="size-4" /></button>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}

export function MiniBrand() {
  return <LogoMark className="size-5" />;
}
