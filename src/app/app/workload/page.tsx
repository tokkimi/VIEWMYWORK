import Link from "next/link";
import { AlertTriangle, CalendarClock, Users } from "lucide-react";
import { requireWorkspace, can } from "@/lib/auth/context";
import { hasFeature } from "@/lib/plans";
import { loadWorkload } from "@/server/queries/workload";
import { loadLevel, hours, DAY_MS } from "@/lib/workload";
import { PageHeader, Section, Stat, Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { CapacityDialog, AbsenceDialog, UnassignedTasks } from "@/components/app/workload";
import { UpgradeCard } from "@/components/app/upgrade-card";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

export const generateMetadata = pageTitle("Team workload");

const CELL: Record<ReturnType<typeof loadLevel>, string> = {
  free: "bg-white/[0.03] text-muted",
  ok: "bg-success-soft text-success",
  busy: "bg-warning-soft text-warning",
  over: "bg-danger-soft text-danger",
};

export default async function Workload() {
  const { t, fmt } = await getI18n();
  const ctx = await requireWorkspace();
  if (!(await hasFeature(ctx.workspace.id, "team_workload")))
    return (
      <>
        <PageHeader title="Team workload" />
        <UpgradeCard title="Team workload planning" description="See who is overloaded or available, week by week, and spread the work fairly." points={["Load vs capacity per person, 6 weeks ahead", "Overdue and due-this-week tasks per person", "Absences and part-time capacity", "Automatic assignment suggestions"]} />
      </>
    );
  const { people, unassigned, suggestions, seeAll, weeks } = await loadWorkload(ctx);
  const manage = can(ctx, "team", "manage");
  const now = weeks[0];
  const tw = people.map((p) => p.weeks[0]!);
  const capacity = tw.reduce((s, w) => s + w.capacity, 0);
  const load = tw.reduce((s, w) => s + w.load, 0);
  const over = people.filter((p) => p.weeks[0]!.utilization > 100).length;
  const overdue = people.reduce((s, p) => s + p.overdue.length, 0);
  const weekLabel = (w: Date, i: number) => (i === 0 ? t("This week") : i === 1 ? t("Next week") : fmt.short(w));

  return (
    <>
      <PageHeader title="Team workload" description={seeAll ? "Planned work against each person's capacity, week by week." : "Your planned work against your capacity, week by week."} />
      <div className="space-y-10">
        <div className="panel grid grid-cols-2 overflow-hidden rounded-2xl sm:grid-cols-5 [&>*]:border-line [&>*:not(:last-child)]:border-r">
          <Stat label="Capacity this week" value={`${hours(capacity)} h`} />
          <Stat label="Planned this week" value={`${hours(load)} h`} hint={capacity ? t("{pct}% of capacity", { pct: Math.round((load / capacity) * 100) }) : undefined} tone={load > capacity ? "danger" : undefined} />
          <Stat label="Overloaded" value={over} tone={over ? "danger" : undefined} hint={t("people this week")} />
          <Stat label="Overdue tasks" value={overdue} tone={overdue ? "warning" : undefined} />
          <Stat label="Unassigned tasks" value={unassigned.length} tone={unassigned.length ? "accent" : undefined} />
        </div>

        <Section title="Load by person" description="Hours planned / available. Green: comfortable · orange: busy (85%+) · red: overloaded.">
          {people.length === 0 ? <EmptyState icon={<Users />} title="No team members" description="Invite collaborators to plan their workload." /> : (
            <div className="panel overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2.5 font-medium"><Tr>Person</Tr></th>
                    <th className="px-2 py-2.5 text-center font-medium"><Tr>Overdue</Tr></th>
                    <th className="px-2 py-2.5 text-center font-medium"><Tr>Due this week</Tr></th>
                    {weeks.map((w, i) => <th key={w.toISOString()} className="px-1.5 py-2.5 text-center font-medium">{weekLabel(w, i)}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {people.map((p) => (
                    <tr key={p.memberId} className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={p.name} src={p.avatarUrl} size={28} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{p.name}{p.isMe && <span className="ml-1 text-xs text-subtle">({t("you")})</span>}</div>
                            <div className="truncate text-xs text-muted">{p.title ?? ""}</div>
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {manage ? <CapacityDialog memberId={p.memberId} name={p.name} hours={Math.round((p.weeklyCapacityMinutes / 60) * 10) / 10} hourlyCost={p.hourlyCostCents !== null ? p.hourlyCostCents / 100 : null} /> : <span className="px-1.5 py-1 text-xs text-muted">{t("{h} h/wk", { h: hours(p.weeklyCapacityMinutes) })}</span>}
                          <AbsenceDialog memberId={p.memberId} name={p.name} canEdit={manage || p.isMe} absences={p.absences.map((a) => ({ ...a, startDate: a.startDate.toISOString(), endDate: a.endDate.toISOString() }))} />
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        {p.overdue.length ? (
                          <details className="text-left">
                            <summary className="cursor-pointer list-none text-center"><Badge tone="danger">{p.overdue.length}</Badge></summary>
                            <ul className="mt-2 w-56 space-y-1 text-xs">{p.overdue.slice(0, 8).map((x) => <li key={x.id}><Link href={`/app/projects/${x.projectId}/tasks?task=${x.id}`} className="block truncate hover:underline">{x.title}</Link><span className="text-danger">{fmt.short(x.deadline)}</span> <span className="text-subtle">· {x.projectName}</span></li>)}</ul>
                          </details>
                        ) : <span className="text-subtle">—</span>}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {p.thisWeek.length ? (
                          <details className="text-left">
                            <summary className="cursor-pointer list-none text-center"><Badge tone="accent">{p.thisWeek.length}</Badge></summary>
                            <ul className="mt-2 w-56 space-y-1 text-xs">{p.thisWeek.slice(0, 8).map((x) => <li key={x.id}><Link href={`/app/projects/${x.projectId}/tasks?task=${x.id}`} className="block truncate hover:underline">{x.title}</Link><span className="text-muted">{fmt.short(x.deadline)}</span> <span className="text-subtle">· {x.projectName}</span></li>)}</ul>
                          </details>
                        ) : <span className="text-subtle">—</span>}
                      </td>
                      {p.weeks.map((w) => (
                        <td key={w.week.toISOString()} className="px-1.5 py-3">
                          <div className={cn("rounded-lg px-1.5 py-2 text-center", w.capacity === 0 && w.load === 0 ? "bg-white/[0.02] text-subtle" : CELL[loadLevel(w.utilization)])} title={t("{load} h planned / {cap} h available", { load: hours(w.load), cap: hours(w.capacity) })}>
                            <div className="num text-[13px] font-semibold">{w.capacity === 0 && w.load === 0 ? "—" : `${Math.min(w.utilization, 999)}%`}</div>
                            <div className="num text-[10.5px] opacity-80">{hours(w.load)}/{hours(w.capacity)} h</div>
                            {w.absentDays > 0 && <div className="text-[10px] opacity-80">{t("{n} d off", { n: w.absentDays })}</div>}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {people.some((p) => p.unscheduledCount > 0) && (
            <p className="mt-3 flex items-start gap-2 text-xs text-muted"><CalendarClock className="mt-0.5 size-3.5 shrink-0" /><Tr>Tasks without a deadline aren&apos;t placed in a week:</Tr> {people.filter((p) => p.unscheduledCount).map((p) => `${p.name} (${p.unscheduledCount})`).join(" · ")}</p>
          )}
          <p className="mt-2 text-xs text-subtle"><Tr>Remaining effort = estimate − time already spent (2 h when a task has no estimate), spread over working days until its deadline. Overdue work counts in the current week.</Tr></p>
        </Section>

        {seeAll && (
          <Section title="Unassigned tasks" description="Open tasks of active projects that nobody owns yet.">
            {unassigned.length === 0 ? <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle"><Tr>Every open task has an owner.</Tr></p> : (
              <UnassignedTasks
                members={people.map((p) => ({ userId: p.userId, name: p.name }))}
                rows={unassigned.slice(0, 100).map((x) => ({ taskId: x.id, title: x.title, projectId: x.projectId, projectName: x.projectName, deadline: x.deadline?.toISOString() ?? null, remaining: x.remaining, suggested: suggestions.get(x.id) ?? null }))}
              />
            )}
          </Section>
        )}

        {people.some((p) => p.weeks[0]!.utilization > 100) && now && (
          <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{t("Overloaded this week: {names}. Reassign or push back deadlines before {date}.", { names: people.filter((p) => p.weeks[0]!.utilization > 100).map((p) => p.name).join(", "), date: fmt.date(new Date(now.getTime() + 4 * DAY_MS)) })}</span>
          </p>
        )}
      </div>
    </>
  );
}
