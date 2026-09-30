import Link from "next/link";
import { Check, Circle } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { ProgressBar, Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { getI18n } from "@/lib/i18n/server";
import { storedText } from "@/lib/i18n/core";
import { Tr } from "@/lib/i18n/client";

export function ProjectRow({ href, name, client, progress, phase, due, attention }: { href: string; name: string; client: string; progress: number; phase?: string | null; due?: string | null; attention?: string | null }) {
  return (
    <Link href={href} className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-4 py-3.5 transition-colors hover:bg-white/[0.025] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium group-hover:text-fg">{name}</div>
        <div className="truncate text-xs text-muted">{client}{phase ? ` · ${phase}` : ""}</div>
      </div>
      <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
        <ProgressBar value={progress} size="sm" label={`${name} — ${progress}%`} />
        <span className="num w-9 shrink-0 text-right text-xs text-muted">{progress}%</span>
      </div>
      <div className="row-start-1 flex flex-col items-end text-right sm:col-start-3 sm:row-start-auto">
        {attention ? <span className="text-[11.5px] text-warning">{attention}</span> : due ? <span className="text-[11.5px] text-subtle">{due}</span> : null}
      </div>
    </Link>
  );
}

export async function ActivityFeed({ items, empty = "No activity yet." }: { items: { id: string; actorName: string; summary: string; metadata?: unknown; createdAt: Date; projectName?: string | null }[]; empty?: string }) {
  const { t, fmt, locale } = await getI18n();
  if (!items.length) return <p className="px-4 py-8 text-center text-sm text-subtle">{t(empty)}</p>;
  return (
    <ol className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 px-4 py-3">
          <Avatar name={a.actorName} size={24} />
          <div className="min-w-0 flex-1 text-[13px]">
            <span className="text-fg">{a.actorName === "System" ? t("System") : a.actorName}</span> <span className="text-muted">— {storedText(locale, a.summary, a.metadata)}</span>
            <div className="mt-0.5 text-[11px] text-subtle">{fmt.rel(a.createdAt)}{a.projectName ? ` · ${a.projectName}` : ""}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Horizontal phase timeline — the product's visual signature. */
export async function PhaseTimeline({ phases, compact }: { phases: { id: string; title: string; status: TaskStatus; progress: number }[]; compact?: boolean }) {
  const { t } = await getI18n();
  if (!phases.length) return null;
  const currentIdx = phases.findIndex((p) => p.status !== "COMPLETED");
  return (
    <ol className={cn("flex w-full items-start", compact ? "gap-1" : "gap-1.5")} aria-label={t("Timeline")}>
      {phases.map((p, i) => {
        const done = p.status === "COMPLETED";
        const current = i === currentIdx;
        return (
          <li key={p.id} className="min-w-0 flex-1" aria-current={current ? "step" : undefined}>
            <div className={cn("h-1 rounded-full", done ? "bg-accent" : current ? "bg-white/[0.08]" : "bg-white/[0.05]")}>
              {current && <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.max(6, p.progress)}%` }} />}
            </div>
            {!compact && (
              <div className="mt-2.5 flex items-center gap-1.5">
                {done ? <Check className="size-3.5 shrink-0 text-accent" /> : current ? <span className="size-2 shrink-0 rounded-full bg-accent" /> : <Circle className="size-3 shrink-0 text-white/15" />}
                <span className={cn("truncate text-xs", done ? "text-muted" : current ? "font-medium text-fg" : "text-subtle")}>{p.title}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ListCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("panel divide-y divide-line overflow-hidden rounded-2xl", className)}>{children}</div>;
}
