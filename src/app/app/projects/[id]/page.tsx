import Link from "next/link";
import { Activity, AlertTriangle, Clock, Monitor } from "lucide-react";
import { hasFeature } from "@/lib/plans";
import { loadPortfolioHealth } from "@/server/queries/health";
import { HEALTH_LABEL, HEALTH_TONE } from "@/lib/health";
import { renderMsg } from "@/lib/i18n/core";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { Section, Stat, Avatar, Badge } from "@/components/ui/primitives";
import { PhaseTimeline, ListCard } from "@/components/app/blocks";
import { DeliverableStatusBadge, InvoiceStatusBadge } from "@/components/status";
import { PublishUpdateDialog, RequestFromClientDialog } from "@/components/app/project-forms";
import { ResolveWaitButton, DeleteUpdateButton } from "@/components/app/project-small-actions";
import { FileGrid } from "@/components/app/files";
import { toFileDTO } from "@/lib/file-dto";
import { daysBetween } from "@/lib/format";
import { deriveStatus, outstandingCents } from "@/lib/invoices/status";
import { Tr } from "@/lib/i18n/client";
import { SitePreviewMini } from "@/components/app/site-preview";
import { buttonClass } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { t, fmt, p: tp, locale } = await getI18n();
  const { id } = await params;
  const { ctx, project, perms } = await loadProject(id);
  const now = new Date();
  const canInv = hasLevel(perms, "invoices", "view");
  const [taskCounts, overdue, nextMilestone, waits, approvals, updates, files, members, invoices] = await Promise.all([
    db.task.groupBy({ by: ["status"], where: { projectId: id, parentId: null }, _count: true }),
    db.task.count({ where: { projectId: id, status: { not: "COMPLETED" }, deadline: { lt: now } } }),
    db.milestone.findFirst({ where: { projectId: id, completedAt: null }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { position: "asc" }] }),
    db.clientWait.findMany({ where: { projectId: id, resolvedAt: null }, orderBy: { startedAt: "asc" } }),
    db.deliverable.findMany({ where: { projectId: id, status: { in: ["WAITING_FOR_CLIENT", "CHANGES_REQUESTED"] } } }),
    db.projectUpdate.findMany({ where: { projectId: id }, orderBy: { publishedAt: "desc" }, take: 3 }),
    db.file.findMany({ where: { projectId: id, deletedAt: null, status: "READY" }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id, status: "ACTIVE", OR: [{ role: { in: ["OWNER", "ADMIN"] } }, { allProjects: true }, { projectMemberships: { some: { projectId: id } } }] }, include: { user: { select: { name: true, avatarUrl: true } } } }),
    canInv ? db.invoice.findMany({ where: { projectId: id, workspaceId: ctx.workspace.id, status: { not: "DRAFT" } }, orderBy: { issueDate: "desc" }, take: 5 }) : Promise.resolve([]),
  ]);
  const count = (s?: string) => taskCounts.filter((t) => !s || t.status === s).reduce((a, t) => a + t._count, 0);
  const completed = count("COMPLETED");
  const total = count();
  const current = project.phases.find((p) => p.status !== "COMPLETED");
  const left = project.targetDate ? daysBetween(now, project.targetDate) : null;
  const overdueInvoices = invoices.filter((i) => deriveStatus(i) === "OVERDUE");
  const openRequests = await db.changeRequest.count({ where: { projectId: id, status: "OPEN" } });
  const preview = await db.preview.findFirst({ where: { projectId: id }, orderBy: [{ type: "desc" }, { createdAt: "asc" }], select: { id: true, url: true, label: true, embeddable: true, imageUrl: true, pageTitle: true } });
  const waitingApprovals = approvals.filter((a) => a.status === "WAITING_FOR_CLIENT").length;
  const changeRequests = approvals.filter((a) => a.status === "CHANGES_REQUESTED").length;
  const health = (await hasFeature(ctx.workspace.id, "portfolio_health")) ? (await loadPortfolioHealth(ctx, new Date(), [id]))[0] : undefined;
  const financeView = hasLevel(perms, "finance", "view");
  const attention = [
    overdue ? tp(overdue, "{n} overdue task", "{n} overdue tasks") : null,
    waitingApprovals ? tp(waitingApprovals, "{n} client approval waiting", "{n} client approvals waiting") : null,
    changeRequests ? tp(changeRequests, "{n} change request to address", "{n} change requests to address") : null,
    overdueInvoices.length ? tp(overdueInvoices.length, "{n} unpaid invoice overdue", "{n} unpaid invoices overdue") : null,
    openRequests ? tp(openRequests, "{n} client change request open", "{n} client change requests open") : null,
  ].filter(Boolean);
  const canEdit = hasLevel(perms, "projects", "edit");
  const canManage = hasLevel(perms, "projects", "manage");
  const site = project.websiteUrl ? { url: project.websiteUrl, label: project.name, embeddable: project.websiteEmbeddable, imageUrl: null, pageTitle: null } : preview;

  return (
    <div className="space-y-10">
      {attention.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-warning/25 bg-warning-soft/50 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-warning"><AlertTriangle className="size-4" /><Tr>Attention required</Tr></span>
          {attention.map((a) => <span key={a} className="text-fg/90">{a}</span>)}
        </div>
      )}

      {health && health.health.status !== "done" && (
        <Link href="/app/health" className="panel flex flex-col gap-2 rounded-2xl px-4 py-3 hover:border-line-strong sm:flex-row sm:items-center sm:gap-4">
          <span className="flex items-center gap-2 text-sm"><Activity className="size-4 text-muted" /><Badge tone={HEALTH_TONE[health.health.status]} dot><Tr>{HEALTH_LABEL[health.health.status]}</Tr></Badge><span className="num text-xs text-muted">{health.health.score}/100</span></span>
          <span className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted sm:flex-row sm:flex-wrap sm:gap-x-3">
            {health.health.alerts.filter((a) => financeView || (a.kind !== "budget" && a.kind !== "cash")).slice(0, 3).map((a, i) => <span key={i} className={a.level === "danger" ? "text-danger" : a.level === "warning" ? "text-warning" : ""}>{renderMsg(locale, a.msg)}</span>)}
            {health.health.alerts.length === 0 && <Tr>No alert: schedule, budget and client are on track.</Tr>}
          </span>
        </Link>
      )}

      <div className="panel grid grid-cols-2 divide-line overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-6 [&>*]:border-line [&>*:not(:last-child)]:border-r">
        <Stat label="Overall progress" value={`${project.progress}%`} tone="accent" />
        <Stat label="Current phase" value={<span className="text-base">{current?.title ?? "—"}</span>} />
        <Stat label="Next milestone" value={<span className="text-base">{nextMilestone?.title ?? "—"}</span>} hint={nextMilestone?.dueDate ? fmt.short(nextMilestone.dueDate) : undefined} />
        <Stat label="Days remaining" value={left === null ? "—" : left < 0 ? t("{n}d late", { n: -left }) : left} tone={left !== null && left < 0 ? "danger" : undefined} />
        <Stat label="Tasks" value={`${completed}/${total}`} hint={t("{n} remaining", { n: total - completed })} />
        <Stat label="Waiting for client" value={waits.length} tone={waits.length ? "warning" : undefined} />
      </div>

      <Section title="Website preview" description={site ? "Desktop and mobile — scroll inside each frame." : "Add the client's website in the project settings to see it here in desktop and mobile versions."} action={site ? <Link href={canManage ? `/app/projects/${id}/settings` : `/app/projects/${id}/preview`} className="text-xs text-muted hover:text-fg"><Tr>{canManage ? "Change website" : "Manage previews"}</Tr></Link> : undefined}>
        {site ? (
          <SitePreviewMini p={site} check={project.websiteUrl ? { kind: "project", id } : preview ? { kind: "preview", id: preview.id } : undefined} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center">
            <Monitor className="size-6 text-muted" />
            <p className="max-w-sm text-sm text-muted"><Tr>No website linked to this project yet.</Tr></p>
            {canManage && <Link href={`/app/projects/${id}/settings`} className={buttonClass("secondary", "sm")}><Tr>Add the website address</Tr></Link>}
          </div>
        )}
      </Section>

      {project.phases.length > 0 ? (
        <Section title="Timeline">
          <div className="panel rounded-2xl p-5"><PhaseTimeline phases={project.phases} /></div>
        </Section>
      ) : (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted"><Tr>No specification yet.</Tr> <Link href={`/app/projects/${id}/specification`} className="text-accent hover:underline"><Tr>Build the specification</Tr></Link> <Tr>to give your client a timeline.</Tr></div>
      )}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <Section title="Recent updates" description="Published to the client portal." action={canEdit ? <PublishUpdateDialog projectId={id} /> : undefined}>
            {updates.length === 0 ? <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle"><Tr>No updates yet. Post one to keep your client in the loop.</Tr></p> : (
              <ol className="space-y-3">
                {updates.map((u) => (
                  <li key={u.id} className="panel rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-subtle"><span>{fmt.date(u.publishedAt)} · {u.authorName}</span>{canEdit && <DeleteUpdateButton id={u.id} />}</div>
                    {u.title && <div className="mt-2 text-sm font-medium">{u.title}</div>}
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">{u.body}</p>
                    {u.nextSteps && <p className="mt-3 text-sm"><span className="text-subtle"><Tr>Next:</Tr> </span>{u.nextSteps}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Section>
          <Section title="Recent files" action={<Link href={`/app/projects/${id}/files`} className="text-xs text-muted hover:text-fg"><Tr>All files</Tr></Link>}>
            {files.length === 0 ? <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle"><Tr>No files yet.</Tr></p> : <FileGrid files={files.map(toFileDTO)} />}
          </Section>
        </div>
        <div className="space-y-10">
          <Section title="Waiting for client" action={canEdit ? <RequestFromClientDialog projectId={id} /> : undefined}>
            {waits.length === 0 && approvals.length === 0 ? <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle"><Tr>Nothing pending on the client.</Tr></p> : (
              <ListCard>
                {approvals.map((d) => <Link key={d.id} href={`/app/projects/${id}/deliverables#${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/[0.02]"><span className="truncate">{d.title}</span><DeliverableStatusBadge s={d.status} /></Link>)}
                {waits.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1"><div className="truncate">{w.label}</div><div className="flex items-center gap-1 text-xs text-warning"><Clock className="size-3" />{t("Waiting for client for {n} days", { n: Math.max(0, daysBetween(w.startedAt, now)) })}</div></div>
                    {canEdit && w.entityType !== "INVOICE" && <ResolveWaitButton id={w.id} />}
                  </div>
                ))}
              </ListCard>
            )}
          </Section>
          <Section title="Team">
            <ListCard>
              {members.map((m) => <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"><Avatar name={m.user.name} src={m.user.avatarUrl} size={26} /><span className="flex-1 truncate">{m.user.name}</span><span className="text-xs text-subtle">{m.title ?? m.role.replace("_", " ").toLowerCase()}</span></div>)}
            </ListCard>
          </Section>
          {canInv && (
            <Section title="Invoices" action={<Link href={`/app/projects/${id}/invoices`} className="text-xs text-muted hover:text-fg"><Tr>All</Tr></Link>}>
              {invoices.length === 0 ? <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle"><Tr>No invoices issued.</Tr></p> : (
                <ListCard>{invoices.map((i) => <Link key={i.id} href={`/app/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/[0.02]"><span className="num">{i.number}</span><span className="num text-muted">{fmt.money(outstandingCents(i) || i.totalCents, i.currency)}</span><InvoiceStatusBadge s={deriveStatus(i)} /></Link>)}</ListCard>
              )}
            </Section>
          )}
          {!project.portalEnabled && <p className="text-xs text-subtle"><Badge><Tr>Portal hidden</Tr></Badge> <Tr>This project isn&apos;t visible in the client portal. Enable it in Settings.</Tr></p>}
        </div>
      </div>
    </div>
  );
}
