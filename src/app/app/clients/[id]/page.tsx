import { uploadLimitMb } from "@/lib/storage";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FolderKanban, Plus, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, requirePerm, can, isUuid, projectScope } from "@/lib/auth/context";
import { PageHeader, Section, EmptyState, Avatar, Badge, KeyValue, Stat } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import { ProjectRow, ActivityFeed, ListCard } from "@/components/app/blocks";
import { InvoiceStatusBadge, DeliverableStatusBadge } from "@/components/status";
import { EditClientDialog, InviteToPortalDialog, SendEmailDialog, AddContactDialog } from "@/components/app/client-form";
import { ArchiveClientButton, RevokeAccessButton, RemoveContactButton } from "@/components/app/client-actions";
import { FileGrid, DeletedFiles } from "@/components/app/files";
import { toFileDTO } from "@/lib/file-dto";
import { Uploader } from "@/components/app/uploader";
import { MessageThread } from "@/components/app/messages";
import { deriveStatus, outstandingCents } from "@/lib/invoices/status";
import { integrations } from "@/lib/env";
import { PROJECT_STATUS } from "@/lib/labels";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Client");

export default async function ClientProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { t, fmt } = await getI18n();
  const ctx = await requireWorkspace();
  requirePerm(ctx, "clients", "view");
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  if (!isUuid(id)) notFound();
  const client = await db.client.findFirst({ where: { id, workspaceId: ctx.workspace.id }, include: { contacts: true, portalAccess: { where: { revokedAt: null }, include: { user: { select: { name: true, email: true, lastActiveAt: true } } } } } });
  if (!client) notFound();
  const name = client.company || `${client.firstName} ${client.lastName}`;
  const scope = projectScope(ctx);
  const canInv = can(ctx, "invoices", "view");
  const canEdit = can(ctx, "clients", "edit");
  const base = `/app/clients/${id}`;

  const [projects, invoices, activity] = await Promise.all([
    db.project.findMany({ where: { ...scope, clientId: id }, include: { phases: { orderBy: { position: "asc" }, select: { title: true, status: true } } }, orderBy: { updatedAt: "desc" } }),
    canInv ? db.invoice.findMany({ where: { workspaceId: ctx.workspace.id, clientId: id }, include: { project: { select: { name: true } } }, orderBy: { issueDate: "desc" }, take: 100 }) : Promise.resolve([]),
    db.activityLog.findMany({ where: { workspaceId: ctx.workspace.id, clientId: id }, orderBy: { createdAt: "desc" }, take: tab === "activity" ? 100 : 8 }),
  ]);
  const projectIds = projects.map((p) => p.id);
  const active = projects.filter((p) => !p.archivedAt && ["ACTIVE", "PLANNING", "ON_HOLD"].includes(p.status));
  const unpaid = invoices.filter((i) => ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status));

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/app/clients" className="hover:text-fg"><Tr>Clients</Tr></Link>}
        title={<span className="flex items-center gap-3"><Avatar name={name} src={client.avatarUrl} size={36} />{name}{client.archivedAt && <Badge><Tr>Archived</Tr></Badge>}</span>}
        description={client.company ? `${client.firstName} ${client.lastName} · ${client.email}` : client.email}
        actions={
          <>
            {canEdit && <EditClientDialog v={client} />}
            {can(ctx, "projects", "manage") && <ButtonLink href={`/app/projects/new?clientId=${id}`}><Plus className="size-4" /><Tr>New project</Tr></ButtonLink>}
            {can(ctx, "messages", "send") && client.email && <SendEmailDialog clientId={id} to={client.email} userEmail={ctx.user.email} />}
            {can(ctx, "invoices", "edit") && <ButtonLink href={`/app/invoices/new?clientId=${id}`}><Receipt className="size-4" /><Tr>Create invoice</Tr></ButtonLink>}
            {canEdit && <InviteToPortalDialog clientId={id} email={client.email} phone={client.phone} />}
          </>
        }
      />
      <Suspense>
        <LinkTabs
          exact
          tabs={[
            { href: base, label: "Overview" },
            { href: `${base}?tab=projects`, label: "Projects", count: projects.length },
            { href: `${base}?tab=messages`, label: "Messages" },
            { href: `${base}?tab=files`, label: "Files" },
            ...(canInv ? [{ href: `${base}?tab=invoices`, label: "Invoices", count: unpaid.length }] : []),
            ...(can(ctx, "finance", "view") ? [{ href: `${base}?tab=finance`, label: "Finance" }] : []),
            { href: `${base}?tab=activity`, label: "Activity" },
          ]}
        />
      </Suspense>

      {tab === "overview" && <Overview />}
      {tab === "projects" && (
        projects.length === 0 ? <EmptyState icon={<FolderKanban />} title="No projects yet" action={can(ctx, "projects", "manage") ? <ButtonLink href={`/app/projects/new?clientId=${id}`} variant="primary"><Tr>New project</Tr></ButtonLink> : undefined} /> : (
          <ListCard>{projects.map((p) => <ProjectRow key={p.id} href={`/app/projects/${p.id}`} name={p.name} client={p.archivedAt ? t("Archived") : t(PROJECT_STATUS[p.status].label)} progress={p.progress} phase={p.phases.find((x) => x.status !== "COMPLETED")?.title} due={p.targetDate ? t("Due {date}", { date: fmt.short(p.targetDate) }) : null} />)}</ListCard>
        )
      )}
      {tab === "messages" && <Messages />}
      {tab === "files" && <Files />}
      {tab === "invoices" && canInv && <Invoices />}
      {tab === "finance" && can(ctx, "finance", "view") && <Finance />}
      {tab === "activity" && <div className="panel rounded-2xl"><ActivityFeed items={activity} /></div>}
    </>
  );

  async function Overview() {
    const { t, fmt } = await getI18n();
    const [approvals, waits, files] = await Promise.all([
      db.deliverable.findMany({ where: { projectId: { in: projectIds }, status: "WAITING_FOR_CLIENT" }, take: 5 }),
      db.clientWait.findMany({ where: { projectId: { in: projectIds }, resolvedAt: null }, take: 5 }),
      db.file.findMany({ where: { workspaceId: ctx.workspace.id, deletedAt: null, status: "READY", OR: [{ clientId: id }, { projectId: { in: projectIds } }] }, orderBy: { createdAt: "desc" }, take: 6 }),
    ]);
    return (
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <Section title="Active projects">
            {active.length === 0 ? <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle"><Tr>No active projects.</Tr></p> : <ListCard>{active.map((p) => <ProjectRow key={p.id} href={`/app/projects/${p.id}`} name={p.name} client={t(p.type ?? t("Project"))} progress={p.progress} phase={p.phases.find((x) => x.status !== "COMPLETED")?.title} due={p.targetDate ? t("Due {date}", { date: fmt.short(p.targetDate) }) : null} />)}</ListCard>}
          </Section>
          <Section title="Pending approvals & requests">
            {approvals.length + waits.length === 0 ? <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle"><Tr>Nothing pending.</Tr></p> : (
              <ListCard>
                {approvals.map((d) => <Link key={d.id} href={`/app/projects/${d.projectId}/deliverables#${d.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-white/[0.02]"><span>{d.title}</span><DeliverableStatusBadge s={d.status} /></Link>)}
                {waits.map((w) => <div key={w.id} className="flex items-center justify-between px-4 py-3 text-sm"><span>{w.label}</span><span className="text-xs text-warning"><Tr>since</Tr> {fmt.short(w.startedAt)}</span></div>)}
              </ListCard>
            )}
          </Section>
          <Section title="Recent files">
            {files.length === 0 ? <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle"><Tr>No files yet.</Tr></p> : <FileGrid files={files.map(toFileDTO)} />}
          </Section>
          <Section title="Recent activity"><div className="panel rounded-2xl"><ActivityFeed items={activity} /></div></Section>
        </div>
        <div className="space-y-10">
          <Section title="Contact">
            <div className="panel rounded-2xl px-4">
              <KeyValue items={[
                { k: "Email", v: <a href={`mailto:${client!.email}`} className="hover:underline">{client!.email}</a> },
                { k: "Phone", v: client!.phone },
                { k: "Billing email", v: client!.billingEmail },
                { k: "Address", v: client!.billingAddress && <span className="whitespace-pre-line">{client!.billingAddress}</span> },
                { k: "Country", v: client!.country },
                { k: "Currency", v: client!.currency },
                { k: "Language", v: client!.preferredLanguage.toUpperCase() },
                { k: "VAT", v: client!.vatNumber },
              ]} />
            </div>
            {client!.notes && <p className="mt-3 whitespace-pre-line rounded-xl border border-line p-3 text-xs text-muted"><span className="eyebrow mb-1 block"><Tr>Internal notes</Tr></span>{client!.notes}</p>}
          </Section>
          <Section title="Contacts" action={canEdit ? <AddContactDialog clientId={id} /> : undefined}>
            {client!.contacts.length === 0 ? <p className="text-sm text-subtle"><Tr>No secondary contacts.</Tr></p> : (
              <ListCard>{client!.contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Avatar name={c.name} size={26} />
                  <div className="min-w-0 flex-1"><div className="truncate">{c.name}{c.role && <span className="text-muted"> · {c.role}</span>}</div><div className="truncate text-xs text-muted">{[c.email, c.phone].filter(Boolean).join(" · ")}</div></div>
                  {canEdit && (c.email || c.phone) && <InviteToPortalDialog clientId={id} email={c.email ?? ""} phone={c.phone} label="Invite" />}
                  {canEdit && <RemoveContactButton id={c.id} />}
                </div>
              ))}</ListCard>
            )}
          </Section>
          <Section title="Portal access">
            {client!.portalAccess.length === 0 ? <p className="text-sm text-subtle"><Tr>Nobody has access yet. Invite your client to their portal.</Tr></p> : (
              <ListCard>{client!.portalAccess.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1"><div className="truncate">{a.user.name}</div><div className="truncate text-xs text-muted">{a.user.email}{a.user.lastActiveAt ? ` · ${t("last seen {date}", { date: fmt.short(a.user.lastActiveAt) })}` : ""}</div></div>
                  {canEdit && <RevokeAccessButton id={a.id} />}
                </div>
              ))}</ListCard>
            )}
          </Section>
          {canInv && unpaid.length > 0 && (
            <Section title="Unpaid invoices">
              <ListCard>{unpaid.map((i) => <Link key={i.id} href={`/app/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/[0.02]"><span className="num">{i.number}</span><span className="num">{fmt.money(outstandingCents(i), i.currency)}</span><InvoiceStatusBadge s={deriveStatus(i)} /></Link>)}</ListCard>
            </Section>
          )}
          {canEdit && <ArchiveClientButton id={id} archived={Boolean(client!.archivedAt)} />}
        </div>
      </div>
    );
  }

  async function Messages() {
    const msgs = await db.message.findMany({ where: { workspaceId: ctx.workspace.id, projectId: { in: projectIds } }, orderBy: { createdAt: "asc" }, take: 200, include: { project: { select: { name: true } } } });
    if (!projects.length) return <EmptyState title="No projects yet" description="Messages are attached to projects. Create a project to start a conversation." />;
    return <MessageThread messages={msgs.map((m) => ({ ...m, context: m.project?.name ?? null }))} projectChoices={projects.filter((p) => !p.archivedAt).map((p) => ({ id: p.id, name: p.name }))} canPost={can(ctx, "messages", "send")} />;
  }

  async function Files() {
    const [files, deleted] = await Promise.all([
      db.file.findMany({ where: { workspaceId: ctx.workspace.id, deletedAt: null, status: "READY", OR: [{ clientId: id }, { projectId: { in: projectIds } }] }, orderBy: { createdAt: "desc" }, take: 200 }),
      db.file.findMany({ where: { workspaceId: ctx.workspace.id, deletedAt: { gte: new Date(Date.now() - 30 * 86400_000) }, storageKey: { not: null }, OR: [{ clientId: id }, { projectId: { in: projectIds } }] }, orderBy: { deletedAt: "desc" }, take: 50, select: { id: true, name: true, deletedAt: true } }),
    ]);
    return (
      <div className="space-y-6">
        {can(ctx, "files", "upload") && <Uploader target={{ clientId: id }} configured={integrations.storage()} maxMb={uploadLimitMb()} defaultVisibility="CLIENT_VISIBLE" />}
        {files.length === 0 ? <EmptyState title="No files yet" description="Contracts, briefs and assets for this client will appear here." /> : <FileGrid files={files.map(toFileDTO)} canManage={can(ctx, "files", "upload")} />}
        {can(ctx, "files", "upload") && <DeletedFiles files={deleted.map((f) => ({ id: f.id, name: f.name, deletedAt: f.deletedAt!.toISOString() }))} />}
      </div>
    );
  }

  async function Invoices() {
    const { t, fmt } = await getI18n();
    const paid = invoices.reduce((a, i) => a + (i.currency === client!.currency ? i.paidCents : 0), 0);
    const out = unpaid.reduce((a, i) => a + (i.currency === client!.currency ? outstandingCents(i) : 0), 0);
    return (
      <div className="space-y-6">
        <div className="panel grid grid-cols-2 divide-x divide-line rounded-2xl sm:grid-cols-3">
          <Stat label="Invoices" value={invoices.length} />
          <Stat label="Paid" value={fmt.money(paid, client!.currency)} />
          <Stat label="Outstanding" value={fmt.money(out, client!.currency)} tone={out ? "warning" : undefined} />
        </div>
        {invoices.length === 0 ? <EmptyState icon={<Receipt />} title="No invoices yet" description="Create your first invoice and send it directly to your client." action={can(ctx, "invoices", "edit") ? <ButtonLink href={`/app/invoices/new?clientId=${id}`} variant="primary"><Tr>Create invoice</Tr></ButtonLink> : undefined} /> : (
          <ListCard>{invoices.map((i) => (
            <Link key={i.id} href={`/app/invoices/${i.id}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-sm hover:bg-white/[0.02] sm:grid-cols-[120px_1fr_100px_110px_110px]">
              <span className="num font-medium">{i.number ?? t("Draft")}</span>
              <span className="hidden truncate text-muted sm:block">{i.project?.name ?? "—"}</span>
              <span className="hidden text-muted sm:block">{fmt.date(i.dueDate)}</span>
              <span className="num text-right">{fmt.money(i.totalCents, i.currency)}</span>
              <span className="text-right"><InvoiceStatusBadge s={deriveStatus(i)} /></span>
            </Link>
          ))}</ListCard>
        )}
      </div>
    );
  }

  async function Finance() {
    const { t, fmt } = await getI18n();
    const [expenses, payments] = await Promise.all([
      db.expense.aggregate({ where: { workspaceId: ctx.workspace.id, projectId: { in: projectIds }, currency: client!.currency }, _sum: { amountCents: true } }),
      db.payment.aggregate({ where: { workspaceId: ctx.workspace.id, clientId: id, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] }, currency: client!.currency }, _sum: { amountCents: true, refundedCents: true } }),
    ]);
    const budget = projects.reduce((a, p) => a + (p.currency === client!.currency ? p.budgetCents ?? 0 : 0), 0);
    const revenue = (payments._sum.amountCents ?? 0) - (payments._sum.refundedCents ?? 0);
    const exp = expenses._sum.amountCents ?? 0;
    return (
      <div className="panel grid grid-cols-2 divide-x divide-line rounded-2xl sm:grid-cols-4">
        <Stat label="Total budgets" value={fmt.money(budget, client!.currency)} />
        <Stat label="Revenue collected" value={fmt.money(revenue, client!.currency)} />
        <Stat label="Expenses" value={fmt.money(exp, client!.currency)} />
        <Stat label="Estimated margin" value={fmt.money(revenue - exp, client!.currency)} tone={revenue - exp < 0 ? "danger" : undefined} hint={t("in {currency}", { currency: client!.currency })} />
      </div>
    );
  }
}

