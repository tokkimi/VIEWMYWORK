import Link from "next/link";
import { Bell, FolderKanban, Users, Receipt, UsersRound, Settings2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/tabs";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MarkAllRead, NotificationLink } from "./notification-actions";

const FILTERS = [
  ["all", "All"],
  ["unread", "Unread"],
  ["PROJECT", "Projects"],
  ["CLIENT", "Clients"],
  ["BILLING", "Billing"],
  ["TEAM", "Team"],
  ["SYSTEM", "System"],
] as const;
const ICON: Record<string, React.ComponentType<{ className?: string }>> = { PROJECT: FolderKanban, CLIENT: Users, BILLING: Receipt, TEAM: UsersRound, SYSTEM: Settings2 };
const PER = 30;

export async function NotificationList({ userId, filter = "all", page = 1, base }: { userId: string; filter?: string; page?: number; base: string }) {
  const where: Prisma.NotificationWhereInput = { userId };
  if (filter === "unread") where.readAt = null;
  else if (filter !== "all" && FILTERS.some(([k]) => k === filter)) where.category = filter;
  const [total, items, unread] = await Promise.all([
    db.notification.count({ where }),
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter notifications">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={`${base}?filter=${k}`} aria-current={filter === k ? "page" : undefined} className={cn("h-7 rounded-full px-3 text-xs leading-7", filter === k ? "bg-white/[0.09] text-fg" : "text-muted hover:text-fg")}>{label}{k === "unread" && unread ? ` (${unread})` : ""}</Link>
          ))}
        </div>
        {unread > 0 && <MarkAllRead />}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title="You're all caught up" description="Approvals, payments, comments and deadlines will show up here." />
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden rounded-2xl">
          {items.map((n) => {
            const Icon = ICON[n.category] ?? Bell;
            return (
              <li key={n.id} className={cn(!n.readAt && "bg-accent-soft/20")}>
                <NotificationLink id={n.id} href={n.actionUrl} unread={!n.readAt}>
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.03]"><Icon className="size-4 text-muted" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm">{!n.readAt && <span className="size-1.5 rounded-full bg-accent" aria-label="Unread" />}{n.title}</span>
                    <span className="mt-0.5 block whitespace-pre-line text-[13px] text-muted">{n.message}</span>
                    <span className="mt-1 flex items-center gap-3 text-[11px] text-subtle">{relativeTime(n.createdAt)}{n.actionUrl && <span className="text-accent">{n.actionLabel ?? "Open"} →</span>}</span>
                  </span>
                </NotificationLink>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => `${base}?filter=${filter}&page=${p}`} />
    </div>
  );
}
