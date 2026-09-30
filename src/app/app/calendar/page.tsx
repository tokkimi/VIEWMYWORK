import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, projectScope, can } from "@/lib/auth/context";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { LinkTabs } from "@/components/ui/tabs";
import { AddMeetingDialog } from "@/components/app/calendar-forms";
import { DeleteEventButton } from "@/components/app/project-small-actions";
import { inputClass } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Calendar" };

type Ev = { id: string; date: Date; title: string; sub: string; kind: "task" | "milestone" | "project" | "meeting" | "invoice"; href: string; late?: boolean; deletable?: boolean };
const KIND_DOT: Record<Ev["kind"], string> = { task: "bg-white/50", milestone: "bg-accent", project: "bg-accent", meeting: "bg-success", invoice: "bg-warning" };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function Calendar({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; project?: string; client?: string; member?: string; invoices?: string }> }) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const view = sp.view === "week" || sp.view === "agenda" ? sp.view : "month";
  const anchor = sp.date && !isNaN(Date.parse(sp.date)) ? new Date(sp.date) : new Date();
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  let start: Date, end: Date;
  if (view === "month") {
    const first = new Date(Date.UTC(y, m, 1));
    start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 86400_000);
    end = new Date(start.getTime() + 42 * 86400_000);
  } else if (view === "week") {
    const a = new Date(Date.UTC(y, m, anchor.getUTCDate()));
    start = new Date(a.getTime() - ((a.getUTCDay() + 6) % 7) * 86400_000);
    end = new Date(start.getTime() + 7 * 86400_000);
  } else {
    start = new Date(Date.UTC(y, m, anchor.getUTCDate()));
    end = new Date(start.getTime() + 60 * 86400_000);
  }
  const scope = { ...projectScope(ctx), archivedAt: null, ...(sp.project ? { id: sp.project } : {}), ...(sp.client ? { clientId: sp.client } : {}) };
  const showInvoices = can(ctx, "invoices", "view") && sp.invoices !== "0";
  const [tasks, milestones, projects, meetings, invoices, allProjects, members, clients] = await Promise.all([
    db.task.findMany({ where: { workspaceId: ctx.workspace.id, deadline: { gte: start, lt: end }, project: scope, ...(sp.member ? { assigneeId: sp.member } : {}) }, include: { project: { select: { name: true } } }, take: 500 }),
    db.milestone.findMany({ where: { dueDate: { gte: start, lt: end }, phase: { project: scope } }, include: { phase: { select: { project: { select: { id: true, name: true } } } } } }),
    db.project.findMany({ where: { ...scope, targetDate: { gte: start, lt: end } }, select: { id: true, name: true, targetDate: true, status: true } }),
    db.calendarEvent.findMany({ where: { workspaceId: ctx.workspace.id, startsAt: { gte: start, lt: end }, OR: [{ projectId: null }, { project: scope }] }, include: { project: { select: { name: true } } } }),
    showInvoices ? db.invoice.findMany({ where: { workspaceId: ctx.workspace.id, dueDate: { gte: start, lt: end }, status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] }, ...(sp.project ? { projectId: sp.project } : {}), ...(sp.client ? { clientId: sp.client } : {}) }, include: { client: true } }) : Promise.resolve([]),
    db.project.findMany({ where: { ...projectScope(ctx), archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id, status: "ACTIVE" }, include: { user: { select: { id: true, name: true } } } }),
    can(ctx, "clients", "view") ? db.client.findMany({ where: { workspaceId: ctx.workspace.id, archivedAt: null }, select: { id: true, company: true, firstName: true, lastName: true } }) : Promise.resolve([]),
  ]);
  const now = new Date();
  const events: Ev[] = [
    ...tasks.map((t) => ({ id: t.id, date: t.deadline!, title: t.title, sub: t.project.name, kind: "task" as const, href: `/app/projects/${t.projectId}/tasks?task=${t.id}`, late: t.status !== "COMPLETED" && t.deadline! < now })),
    ...milestones.map((ms) => ({ id: ms.id, date: ms.dueDate!, title: `◆ ${ms.title}`, sub: ms.phase.project.name, kind: "milestone" as const, href: `/app/projects/${ms.phase.project.id}/specification` })),
    ...projects.map((p) => ({ id: p.id, date: p.targetDate!, title: `${p.name} — target`, sub: "Project deadline", kind: "project" as const, href: `/app/projects/${p.id}` })),
    ...meetings.map((e) => ({ id: e.id, date: e.startsAt, title: `${e.startsAt.toISOString().slice(11, 16)} ${e.title}`, sub: e.project?.name ?? e.location ?? "Meeting", kind: "meeting" as const, href: e.projectId ? `/app/projects/${e.projectId}` : "/app/calendar", deletable: e.createdById === ctx.user.id || ctx.isAdmin })),
    ...invoices.map((i) => ({ id: i.id, date: i.dueDate, title: `${i.number} due`, sub: `${i.client.company || i.client.lastName} · ${formatMoney(i.totalCents - i.paidCents, i.currency)}`, kind: "invoice" as const, href: `/app/invoices/${i.id}` })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  const byDay = new Map<string, Ev[]>();
  for (const e of events) byDay.set(iso(e.date), [...(byDay.get(iso(e.date)) ?? []), e]);

  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...o })) if (v) p.set(k, v);
    return `/app/calendar?${p}`;
  };
  const step = view === "month" ? (d: number) => iso(new Date(Date.UTC(y, m + d, 1))) : view === "week" ? (d: number) => iso(new Date(start.getTime() + d * 7 * 86400_000)) : (d: number) => iso(new Date(start.getTime() + d * 30 * 86400_000));
  const title = view === "month" ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 1))) : `${fmtDate(start)} – ${fmtDate(new Date(end.getTime() - 86400_000))}`;
  const days = Array.from({ length: Math.round((end.getTime() - start.getTime()) / 86400_000) }, (_, i) => new Date(start.getTime() + i * 86400_000));

  return (
    <>
      <PageHeader title="Calendar" actions={<AddMeetingDialog projects={allProjects} />} />
      <Suspense><LinkTabs exact tabs={[{ href: qs({ view: "month" }), label: "Month" }, { href: qs({ view: "week" }), label: "Week" }, { href: qs({ view: "agenda" }), label: "Agenda" }]} /></Suspense>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={qs({ date: step(-1) })} aria-label="Previous" className="rounded-lg border border-line p-1.5 text-muted hover:text-fg"><ChevronLeft className="size-4" /></Link>
          <Link href={qs({ date: iso(new Date()) })} className="rounded-lg border border-line px-3 py-1 text-sm text-muted hover:text-fg">Today</Link>
          <Link href={qs({ date: step(1) })} aria-label="Next" className="rounded-lg border border-line p-1.5 text-muted hover:text-fg"><ChevronRight className="size-4" /></Link>
          <h2 className="ml-2 text-lg font-medium">{title}</h2>
        </div>
        <form className="flex flex-wrap gap-2" aria-label="Filters">
          <input type="hidden" name="view" value={view} />
          {sp.date && <input type="hidden" name="date" value={sp.date} />}
          <select name="project" defaultValue={sp.project ?? ""} aria-label="Project" className={`${inputClass} w-auto`}><option value="">All projects</option>{allProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          {clients.length > 0 && <select name="client" defaultValue={sp.client ?? ""} aria-label="Client" className={`${inputClass} w-auto`}><option value="">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company || `${c.firstName} ${c.lastName}`}</option>)}</select>}
          <select name="member" defaultValue={sp.member ?? ""} aria-label="Team member" className={`${inputClass} w-auto`}><option value="">Everyone</option>{members.map((mm) => <option key={mm.user.id} value={mm.user.id}>{mm.user.name}</option>)}</select>
          {can(ctx, "invoices", "view") && <select name="invoices" defaultValue={sp.invoices ?? "1"} aria-label="Invoices" className={`${inputClass} w-auto`}><option value="1">With invoices</option><option value="0">Hide invoices</option></select>}
          <button className="h-9 rounded-[10px] border border-line px-3 text-sm text-muted hover:text-fg">Apply</button>
        </form>
      </div>

      {view === "agenda" ? (
        events.length === 0 ? <EmptyState title="Nothing scheduled" description="Deadlines, milestones, meetings and invoice due dates appear here." /> : (
          <ol className="space-y-6">
            {[...byDay.entries()].map(([day, evs]) => (
              <li key={day}>
                <div className="eyebrow mb-2">{fmtDate(day, { weekday: "long", month: "long", day: "numeric" })}</div>
                <ul className="panel divide-y divide-line rounded-2xl">{evs.map((e) => <EventRow key={e.kind + e.id} e={e} />)}</ul>
              </li>
            ))}
          </ol>
        )
      ) : (
        <div className="panel overflow-x-auto rounded-2xl">
          <div className="grid min-w-[760px] grid-cols-7">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b border-line px-2 py-2 text-[11px] uppercase tracking-wide text-subtle">{d}</div>)}
            {days.map((d) => {
              const evs = byDay.get(iso(d)) ?? [];
              const out = view === "month" && d.getUTCMonth() !== m;
              const today = iso(d) === iso(new Date());
              return (
                <div key={iso(d)} className={cn("min-h-28 border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0", view === "week" && "min-h-80", out && "bg-white/[0.01]")}>
                  <div className={cn("num mb-1 flex size-6 items-center justify-center rounded-full text-xs", today ? "bg-accent text-white" : out ? "text-subtle/60" : "text-muted")}>{d.getUTCDate()}</div>
                  <ul className="space-y-0.5">
                    {evs.slice(0, view === "week" ? 20 : 4).map((e) => (
                      <li key={e.kind + e.id}><Link href={e.href} title={`${e.title} — ${e.sub}`} className="flex items-center gap-1.5 truncate rounded px-1 py-0.5 text-[11.5px] hover:bg-white/[0.05]"><span className={cn("size-1.5 shrink-0 rounded-full", KIND_DOT[e.kind], e.late && "bg-danger")} /><span className={cn("truncate", e.late && "text-danger")}>{e.title}</span></Link></li>
                    ))}
                    {evs.length > (view === "week" ? 20 : 4) && <li className="px-1 text-[11px] text-subtle">+{evs.length - 4} more</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-subtle">
        {(["task", "milestone", "meeting", "invoice"] as const).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", KIND_DOT[k])} />{k === "task" ? "Task deadline" : k === "milestone" ? "Milestone / project deadline" : k === "meeting" ? "Meeting" : "Invoice due"}</span>)}
      </div>
    </>
  );
}

function EventRow({ e }: { e: Ev }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 text-sm">
      <span className={cn("size-2 shrink-0 rounded-full", KIND_DOT[e.kind], e.late && "bg-danger")} />
      <Link href={e.href} className="min-w-0 flex-1 hover:underline"><span className={cn("block truncate", e.late && "text-danger")}>{e.title}</span><span className="block truncate text-xs text-muted">{e.sub}</span></Link>
      {e.deletable && <DeleteEventButton id={e.id} />}
    </li>
  );
}
