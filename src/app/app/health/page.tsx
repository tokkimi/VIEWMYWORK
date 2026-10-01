import Link from "next/link";
import { Activity, AlertTriangle, CalendarClock, CircleDollarSign, Clock, Hourglass, Info } from "lucide-react";
import { requireWorkspace, can } from "@/lib/auth/context";
import { hasFeature } from "@/lib/plans";
import { loadPortfolioHealth, type ProjectHealthRow } from "@/server/queries/health";
import { PageHeader, Section, Stat, Badge, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { UpgradeCard } from "@/components/app/upgrade-card";
import { HEALTH_LABEL, HEALTH_TONE } from "@/lib/health";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { renderMsg } from "@/lib/i18n/core";
import { Tr } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

export const generateMetadata = pageTitle("Project health");

const ICON = { schedule: Clock, budget: CircleDollarSign, client: Hourglass, tasks: AlertTriangle, cash: CircleDollarSign } as const;

export default async function Health({ searchParams }: { searchParams: Promise<{ group?: string; show?: string }> }) {
  const { t, fmt, locale } = await getI18n();
  const render = (m: Parameters<typeof renderMsg>[1]) => renderMsg(locale, m);
  const ctx = await requireWorkspace();
  if (!(await hasFeature(ctx.workspace.id, "portfolio_health")))
    return (
      <>
        <PageHeader title="Project health" />
        <UpgradeCard title="Project health & portfolio steering" description="One page to steer every project: delays, budget, client blockers and profitability." points={["Health score and concrete alerts per project", "Budget consumed and overrun forecast", "Client approvals and documents blocking you", "Margin per project and next deadlines"]} />
      </>
    );
  const sp = await searchParams;
  const finance = can(ctx, "finance", "view");
  const all = await loadPortfolioHealth(ctx);
  const live = all.filter((p) => p.health.status !== "done");
  const shown = (sp.show === "risk" ? live.filter((p) => p.health.status !== "on_track") : sp.show === "done" ? all.filter((p) => p.health.status === "done") : live).sort((a, b) => a.health.score - b.health.score);
  const count = (s: string) => live.filter((p) => p.health.status === s).length;
  const overdue = live.reduce((s, p) => s + p.overdueTasks, 0);
  const waits = live.reduce((s, p) => s + p.clientWaits, 0);
  const cur = ctx.workspace.defaultCurrency;
  const overrun = live.filter((p) => p.currency === cur && p.budgetCents && (p.health.forecastCostCents ?? 0) > p.budgetCents).reduce((s, p) => s + ((p.health.forecastCostCents ?? 0) - (p.budgetCents ?? 0)), 0);
  const margin = live.filter((p) => p.currency === cur && p.health.marginCents !== null).reduce((s, p) => s + (p.health.marginCents ?? 0), 0);

  const groups: [string, ProjectHealthRow[]][] =
    sp.group === "client" ? groupBy(shown, (p) => p.clientName) : sp.group === "manager" ? groupBy(shown, (p) => p.managerName ?? t("No manager")) : [["", shown]];

  const upcoming = live.filter((p) => p.nextDeadline && p.nextDeadline.date.getTime() - Date.now() < 14 * 86_400_000).sort((a, b) => a.nextDeadline!.date.getTime() - b.nextDeadline!.date.getTime());
  const link = (q: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ group: sp.group, show: sp.show, ...q }).filter(([, v]) => v) as [string, string][]);
    return `/app/health${u.size ? `?${u}` : ""}`;
  };
  const chip = (active: boolean) => cn("h-7 rounded-full px-3 text-xs leading-7 transition-colors", active ? "bg-white/[0.09] text-fg" : "text-muted hover:text-fg");

  return (
    <>
      <PageHeader title="Project health" description="Every active project at a glance: schedule, budget, client blockers and profitability." />
      <div className="space-y-10">
        <div className={cn("panel grid grid-cols-2 overflow-hidden rounded-2xl [&>*]:border-line [&>*:not(:last-child)]:border-r", finance ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-4")}>
          <Stat label="Active projects" value={live.length} />
          <Stat label="On track" value={count("on_track")} hint={t("{a} at risk · {b} off track", { a: count("at_risk"), b: count("off_track") })} tone={count("off_track") ? "danger" : count("at_risk") ? "warning" : undefined} />
          <Stat label="Overdue tasks" value={overdue} tone={overdue ? "warning" : undefined} />
          <Stat label="Waiting for client" value={waits} tone={waits ? "warning" : undefined} />
          {finance && <Stat label="Forecast overrun" value={fmt.money(overrun, cur)} tone={overrun > 0 ? "danger" : undefined} />}
          {finance && <Stat label="Forecast margin" value={fmt.money(margin, cur)} tone={margin < 0 ? "danger" : "accent"} />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label={t("Filter")}>
            <Link href={link({ show: undefined })} className={chip(!sp.show)}><Tr>Active</Tr></Link>
            <Link href={link({ show: "risk" })} className={chip(sp.show === "risk")}><Tr>Needs attention</Tr></Link>
            <Link href={link({ show: "done" })} className={chip(sp.show === "done")}><Tr>Recently completed</Tr></Link>
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t("Group by")}>
            <span className="h-7 px-1 text-xs leading-7 text-subtle"><Tr>Group by</Tr></span>
            <Link href={link({ group: undefined })} className={chip(!sp.group)}><Tr>None</Tr></Link>
            <Link href={link({ group: "client" })} className={chip(sp.group === "client")}><Tr>Client</Tr></Link>
            <Link href={link({ group: "manager" })} className={chip(sp.group === "manager")}><Tr>Project manager</Tr></Link>
          </div>
        </div>

        {shown.length === 0 ? (
          <EmptyState icon={<Activity />} title={sp.show === "risk" ? "Nothing needs attention" : "No projects"} description={sp.show === "risk" ? "Every active project is on track." : "Active projects will appear here with their health."} />
        ) : groups.map(([g, rows]) => (
          <Section key={g || "all"} title={g || t("Projects")} description={g ? t("{n} project(s)", { n: rows.length }) : "Sorted by risk: the projects needing attention come first."}>
            <ul className="space-y-3">
              {rows.map((p) => {
                const h = p.health;
                return (
                  <li key={p.id} className="panel rounded-2xl p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/app/projects/${p.id}`} className="block truncate text-[15px] font-semibold hover:underline">{p.name}</Link>
                        <div className="truncate text-xs text-muted">{p.clientName}{p.managerName ? ` · ${t("PM")} ${p.managerName}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={HEALTH_TONE[h.status]} dot><Tr>{HEALTH_LABEL[h.status]}</Tr></Badge>
                        <span className={cn("num rounded-lg border px-2 py-0.5 text-sm font-semibold", h.score >= 75 ? "border-success/30 text-success" : h.score >= 50 ? "border-warning/30 text-warning" : "border-danger/30 text-danger")} title={t("Health score")}>{h.score}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-muted"><Tr>Progress</Tr><span className="num text-fg">{p.progress}%{h.expectedProgress !== null && <span className="text-muted"> / {h.expectedProgress}% {t("expected")}</span>}</span></div>
                        <div className="relative">
                          <ProgressBar value={p.progress} size="sm" label={`${p.name} — ${p.progress}%`} />
                          {h.expectedProgress !== null && <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-fg/70" style={{ left: `${h.expectedProgress}%` }} title={t("Expected today")} />}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-muted"><Tr>Budget</Tr>
                          <span className="num text-fg">{finance && p.budgetCents ? `${h.budgetUsedPct ?? 0}%` : "—"}</span>
                        </div>
                        {finance && p.budgetCents ? (
                          <>
                            <ProgressBar value={Math.min(100, h.budgetUsedPct ?? 0)} size="sm" label={t("Budget used")} />
                            <div className="mt-1 text-[11px] text-subtle">{fmt.money(p.costToDateCents, p.currency)} / {fmt.money(p.budgetCents, p.currency)}{h.forecastCostCents ? ` · ${t("forecast")} ${fmt.money(h.forecastCostCents, p.currency)}` : ""}</div>
                          </>
                        ) : <div className="text-[11px] text-subtle">{finance ? <Tr>No budget set</Tr> : <Tr>Finance hidden</Tr>}</div>}
                      </div>
                      <div className="text-xs text-muted">
                        <div className="flex items-center gap-1.5"><CalendarClock className="size-3.5" />{p.nextDeadline ? <span className="truncate"><span className="text-fg">{fmt.short(p.nextDeadline.date)}</span> · {t(p.nextDeadline.label)}</span> : <Tr>No upcoming deadline</Tr>}</div>
                        {finance && h.marginPct !== null && <div className="mt-1"><Tr>Margin</Tr> <span className={cn("num", h.marginPct < 0 ? "text-danger" : h.marginPct < 20 ? "text-warning" : "text-success")}>{h.marginPct}%</span> · {fmt.money(h.marginCents ?? 0, p.currency)}</div>}
                        <div className="mt-1">{t("{n} open tasks", { n: p.openTasks })}{p.overdueTasks ? <span className="text-danger"> · {t("{n} overdue", { n: p.overdueTasks })}</span> : null}</div>
                      </div>
                    </div>

                    {h.alerts.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {h.alerts.filter((a) => finance || (a.kind !== "budget" && a.kind !== "cash")).map((a, i) => {
                          const Icon = a.level === "info" ? Info : ICON[a.kind];
                          return (
                            <li key={i} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs", a.level === "danger" ? "bg-danger-soft text-danger" : a.level === "warning" ? "bg-warning-soft text-warning" : "bg-white/[0.05] text-muted")}>
                              <Icon className="size-3.5 shrink-0" />{render(a.msg)}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        ))}

        {upcoming.length > 0 && (
          <Section title="Next 14 days" description="The next deadline of each project.">
            <ul className="panel divide-y divide-line rounded-2xl">
              {upcoming.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="num w-16 shrink-0 text-xs text-muted">{fmt.short(p.nextDeadline!.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{t(p.nextDeadline!.label)}</span>
                  <Link href={`/app/projects/${p.id}`} className="max-w-[40%] truncate text-xs text-muted hover:text-fg">{p.name}</Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <p className="text-xs text-subtle"><Tr>Health score out of 100: delays versus the expected progress, overdue and blocked tasks, budget consumed and forecast at completion, items waiting for the client and overdue payments. Costs = time spent × each person&apos;s hourly cost (Team workload) + expenses.</Tr></p>
      </div>
    </>
  );
}

function groupBy(rows: ProjectHealthRow[], key: (r: ProjectHealthRow) => string): [string, ProjectHealthRow[]][] {
  const m = new Map<string, ProjectHealthRow[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return [...m.entries()].sort((a, b) => Math.min(...a[1].map((x) => x.health.score)) - Math.min(...b[1].map((x) => x.health.score)));
}
