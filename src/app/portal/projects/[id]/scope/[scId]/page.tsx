import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, CalendarClock, Coins } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { isUuid } from "@/lib/auth/context";
import { ScopePanel } from "@/components/portal/scope-panel";
import { Badge } from "@/components/ui/primitives";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

export default async function ScopeDecision({ params }: { params: Promise<{ id: string; scId: string }> }) {
  const { t, fmt } = await getI18n();
  const { id, scId } = await params;
  const ctx = await requirePortal();
  const project = await getPortalProject(ctx, id);
  if (!isUuid(scId)) notFound();
  const sc = await db.scopeChange.findFirst({ where: { id: scId, projectId: id, askClient: true } });
  if (!sc) notFound();
  const newTarget = sc.additionalDays > 0 && project.targetDate ? new Date(project.targetDate.getTime() + (sc.status === "PROPOSED" ? sc.additionalDays * 86_400_000 : 0)) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold"><Tr>Scope change</Tr></h2>
            <Badge tone={sc.status === "APPROVED" ? "success" : sc.status === "REJECTED" ? "danger" : "warning"}>{sc.status === "APPROVED" ? t("Accepted") : sc.status === "REJECTED" ? t("Declined") : t("Waiting for your decision")}</Badge>
          </div>
          <p className="mt-1 text-xs text-subtle">{t("Requested by {name}", { name: sc.requestedBy })} · {fmt.date(sc.requestedAt)}</p>
        </div>
        <p className="whitespace-pre-line rounded-2xl border border-line p-4 text-sm">{sc.description}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-center gap-1.5 text-xs text-subtle"><Coins className="size-3.5" /><Tr>Additional cost</Tr></div>
            <div className="num mt-1 text-lg font-semibold">{sc.additionalCostCents > 0 ? `+${fmt.moneyExact(sc.additionalCostCents, project.currency)}` : t("No extra cost")}</div>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-center gap-1.5 text-xs text-subtle"><CalendarClock className="size-3.5" /><Tr>Impact on the schedule</Tr></div>
            <div className="num mt-1 text-lg font-semibold">{sc.additionalDays > 0 ? t("+{n} days", { n: sc.additionalDays }) : t("No delay")}</div>
            {newTarget && <div className="mt-0.5 text-xs text-muted">{t("New delivery date: {date}", { date: fmt.date(newTarget) })}</div>}
          </div>
        </div>
      </div>
      <aside className="space-y-4">
        {sc.status === "PROPOSED" && <ScopePanel id={sc.id} />}
        {sc.status !== "PROPOSED" && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${sc.status === "APPROVED" ? "border-success/30 bg-success-soft text-success" : "border-line text-muted"}`}>
            <div className="flex items-center gap-2">{sc.status === "APPROVED" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}{sc.status === "APPROVED" ? t("Accepted") : t("Declined")}{sc.decidedAt && <span className="text-xs opacity-80">· {fmt.date(sc.decidedAt)}</span>}</div>
            {sc.decidedByName && <div className="mt-1 text-xs opacity-80">{sc.decidedByName}</div>}
            {sc.clientComment && <p className="mt-2 text-muted">“{sc.clientComment}”</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
