import Link from "next/link";
import { BellRing, CheckCircle2, ExternalLink, FileUp, MessageSquare, Scale, CreditCard, Eye, CircleHelp, Settings2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, can, projectScope } from "@/lib/auth/context";
import { hasFeature } from "@/lib/plans";
import { loadDecisions } from "@/server/queries/decisions";
import { PageHeader, Section, Stat, Badge, EmptyState } from "@/components/ui/primitives";
import { UpgradeCard } from "@/components/app/upgrade-card";
import { RemindButton, ReminderSettingsForm } from "@/components/app/decisions";
import { DECISION_LABEL, DEFAULT_REMINDERS, ageDays, manualReminderAllowed, type DecisionItem, type DecisionKind } from "@/lib/decisions";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

export const generateMetadata = pageTitle("Client decisions");

const ICON: Record<DecisionKind, typeof Eye> = { APPROVAL: Eye, DOCUMENT: FileUp, INFORMATION: MessageSquare, PAYMENT: CreditCard, SCOPE: Scale, OTHER: CircleHelp };
const KINDS: DecisionKind[] = ["APPROVAL", "DOCUMENT", "INFORMATION", "SCOPE", "PAYMENT"];

export default async function Decisions({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { t, fmt } = await getI18n();
  const ctx = await requireWorkspace();
  if (!(await hasFeature(ctx.workspace.id, "client_decisions")))
    return (
      <>
        <PageHeader title="Client decisions" />
        <UpgradeCard title="Client decision center" description="Everything waiting for your clients in one list, with automatic reminders." points={["Approvals, documents, information, payments and scope decisions", "How long each item has been waiting", "One-click reminder by email and in the portal", "Automatic reminders on your schedule"]} />
      </>
    );
  const sp = await searchParams;
  const now = new Date();
  const all = await loadDecisions(ctx.workspace.id, projectScope(ctx));
  const kind = KINDS.includes(sp.kind as DecisionKind) ? (sp.kind as DecisionKind) : null;
  const shown = kind ? all.filter((i) => i.kind === kind || (kind === "INFORMATION" && i.kind === "OTHER")) : all;
  const canRemind = can(ctx, "messages", "send");
  const canSettings = can(ctx, "settings", "manage");

  const clientIds = [...new Set(all.map((i) => i.clientId))];
  const [settings, access, sent30] = await Promise.all([
    db.workspaceSetting.findUnique({ where: { workspaceId: ctx.workspace.id }, select: { decisionReminders: true, reminderFirstDays: true, reminderEveryDays: true, reminderMax: true } }),
    db.clientPortalAccess.groupBy({ by: ["clientId"], where: { workspaceId: ctx.workspace.id, clientId: { in: clientIds }, revokedAt: null }, _count: true }),
    db.clientReminder.count({ where: { workspaceId: ctx.workspace.id, sentAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } } }),
  ]);
  const withPortal = new Set(access.map((a) => a.clientId));
  const rules = settings ? { enabled: settings.decisionReminders, firstDays: settings.reminderFirstDays, everyDays: settings.reminderEveryDays, max: settings.reminderMax } : DEFAULT_REMINDERS;

  const groups = new Map<string, DecisionItem[]>();
  for (const i of shown) groups.set(i.clientId, [...(groups.get(i.clientId) ?? []), i]);
  const sortedGroups = [...groups.entries()].sort((a, b) => a[1][0]!.since.getTime() - b[1][0]!.since.getTime());

  const oldest = all.length ? ageDays(all[0]!.since, now) : 0;
  const late = all.filter((i) => ageDays(i.since, now) >= 7).length;
  const count = (k: DecisionKind) => all.filter((i) => i.kind === k || (k === "INFORMATION" && i.kind === "OTHER")).length;
  const chip = (active: boolean) => cn("h-7 rounded-full px-3 text-xs leading-7 transition-colors", active ? "bg-white/[0.09] text-fg" : "text-muted hover:text-fg");

  return (
    <>
      <PageHeader title="Client decisions" description="Everything waiting for an answer from your clients: approvals, documents, information, payments and scope decisions." />
      <div className="space-y-10">
        <div className="panel grid grid-cols-2 overflow-hidden rounded-2xl sm:grid-cols-4 [&>*]:border-line [&>*:not(:last-child)]:border-r">
          <Stat label="Waiting for an answer" value={all.length} tone={all.length ? "warning" : undefined} />
          <Stat label="Clients concerned" value={clientIds.length} />
          <Stat label="Waiting 7+ days" value={late} tone={late ? "danger" : undefined} hint={all.length ? t("Oldest: {n} d", { n: oldest }) : undefined} />
          <Stat label="Reminders (30 days)" value={sent30} hint={rules.enabled ? t("Automatic reminders on") : t("Automatic reminders off")} />
        </div>

        <Section title="Waiting for your clients" action={
          <div className="flex flex-wrap gap-1">
            <Link href="/app/decisions" className={chip(!kind)}>{t("All")} · {all.length}</Link>
            {KINDS.map((k) => count(k) > 0 && <Link key={k} href={`/app/decisions?kind=${k}`} className={chip(kind === k)}>{t(DECISION_LABEL[k])} · {count(k)}</Link>)}
          </div>
        }>
          {sortedGroups.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="size-5" />} title="Nothing is waiting for your clients" description="Approvals, document requests and scope changes you send them will appear here." />
          ) : (
            <div className="space-y-4">
              {sortedGroups.map(([clientId, items]) => {
                const portal = withPortal.has(clientId);
                const remindable = items.filter((i) => manualReminderAllowed(i.lastReminderAt, now));
                return (
                  <div key={clientId} className="panel overflow-hidden rounded-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Link href={`/app/clients/${clientId}`} className="truncate font-medium hover:underline">{items[0]!.clientName}</Link>
                        <Badge tone="warning">{items.length}</Badge>
                        {!portal && <Badge tone="neutral">{t("No portal access")}</Badge>}
                      </div>
                      {canRemind && portal && items.length > 1 && <RemindButton clientId={clientId} keys={items.map((i) => i.key)} disabled={!remindable.length} label={t("Remind about all ({n})", { n: remindable.length || items.length })} />}
                      {!portal && <Link href={`/app/clients/${clientId}`} className="text-xs text-accent hover:underline"><Tr>Share the portal</Tr></Link>}
                    </div>
                    <ul className="divide-y divide-line">
                      {items.map((i) => {
                        const Icon = ICON[i.kind];
                        const days = ageDays(i.since, now);
                        return (
                          <li key={i.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.05]"><Icon className="size-4 text-muted" /></span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-sm font-medium">{i.kind === "PAYMENT" ? t("Invoice {number}", { number: i.title }) : i.title}</span>
                                  <Badge tone={i.kind === "SCOPE" ? "accent" : "neutral"}>{t(DECISION_LABEL[i.kind])}</Badge>
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-subtle">
                                  {i.projectName && <span>{i.projectName}</span>}
                                  {i.amount && <span className="num">{fmt.money(i.amount.cents, i.amount.currency)}</span>}
                                  <span className={cn(days >= 7 ? "text-danger" : days >= 3 ? "text-warning" : undefined)}>{days === 0 ? t("Since today") : t("Waiting {n} d", { n: days })}</span>
                                  {i.reminders > 0 && <span className="inline-flex items-center gap-1"><BellRing className="size-3" />{t("{n} reminder(s), last {date}", { n: i.reminders, date: fmt.date(i.lastReminderAt!) })}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 pl-11 sm:pl-0">
                              <Link href={i.href} className="inline-flex h-8 items-center gap-1 rounded-[10px] px-2.5 text-[13px] text-muted hover:bg-white/[0.05] hover:text-fg"><ExternalLink className="size-3.5" /><Tr>Open</Tr></Link>
                              {canRemind && portal && i.kind !== "PAYMENT" && <RemindButton clientId={clientId} keys={[i.key]} disabled={!manualReminderAllowed(i.lastReminderAt, now)} />}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Automatic reminders" description="Clients receive one grouped email listing what's waiting for them, with a direct link to their portal.">
          <div className="panel rounded-2xl p-5">
            <div className="mb-4 flex items-center gap-2 text-xs text-muted"><Settings2 className="size-3.5" /><Tr>Reminders stop as soon as the client answers.</Tr></div>
            <ReminderSettingsForm settings={rules} canEdit={canSettings} />
          </div>
        </Section>
      </div>
    </>
  );
}
