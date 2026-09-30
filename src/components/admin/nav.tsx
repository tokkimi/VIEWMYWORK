"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const items = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/workspaces", "Workspaces"],
  ["/admin/subscriptions", "Subscriptions"],
  ["/admin/plans", "Plans"],
  ["/admin/projects", "Projects"],
  ["/admin/storage", "Storage"],
  ["/admin/revenue", "Revenue"],
  ["/admin/payments", "Payments"],
  ["/admin/activity", "Activity"],
  ["/admin/support", "Support"],
  ["/admin/system", "System"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Administration" className="overflow-x-auto px-3 pb-3 lg:pb-0">
      <ul className="flex gap-0.5 lg:flex-col">
        {items.map(([href, label]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex h-9 items-center whitespace-nowrap rounded-[10px] px-2.5 text-[13.5px]", active ? "bg-white/[0.07] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg")}>{label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
