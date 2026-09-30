import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspace, can } from "@/lib/auth/context";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { getWorkspacePlan } from "@/lib/plans";
import { daysBetween } from "@/lib/format";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const { t, p: tp } = await getI18n();
  const [memberships, unread, plan] = await Promise.all([
    db.workspaceMember.findMany({ where: { userId: ctx.user.id, status: "ACTIVE" }, include: { workspace: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    db.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
    getWorkspacePlan(ctx.workspace.id),
  ]);
  const banner = !plan
    ? { tone: "danger", text: t("This workspace has no subscription.") }
    : plan.trialExpired || plan.sub.status === "CANCELED" || plan.sub.status === "INCOMPLETE"
      ? { tone: "danger", text: plan.trialExpired ? t("Your free trial has ended. Choose a plan to keep creating projects and invoices.") : t("Your subscription is inactive. Choose a plan to continue.") }
      : plan.sub.status === "PAST_DUE"
        ? { tone: "warning", text: t("Your last subscription payment failed. Update your payment method to avoid interruption.") }
        : plan.sub.status === "TRIALING" && plan.sub.trialEndsAt && daysBetween(new Date(), plan.sub.trialEndsAt) <= 5
          ? { tone: "accent", text: tp(Math.max(0, daysBetween(new Date(), plan.sub.trialEndsAt)), "Your free trial ends in {n} day.", "Your free trial ends in {n} days.") }
          : null;

  return (
    <div className="min-h-dvh">
      <Sidebar
        workspaces={memberships.map((m) => m.workspace)}
        current={{ id: ctx.workspace.id, name: ctx.workspace.name, logoUrl: ctx.workspace.logoUrl }}
        can={{ finance: can(ctx, "finance", "view"), invoices: can(ctx, "invoices", "view"), clients: can(ctx, "clients", "view"), team: can(ctx, "team", "view"), settings: can(ctx, "settings", "manage") }}
        isSuperAdmin={ctx.user.platformRole === "SUPER_ADMIN"}
        unread={unread}
      />
      <div className="lg:pl-[232px]">
        <Topbar allowed={{ projects: can(ctx, "projects", "manage"), clients: can(ctx, "clients", "edit"), tasks: can(ctx, "tasks", "edit"), invoices: can(ctx, "invoices", "edit"), finance: can(ctx, "finance", "edit"), files: can(ctx, "files", "upload") }} />
        {banner && ctx.isAdmin && (
          <div className={`border-b border-line px-6 py-2.5 text-[13px] ${banner.tone === "danger" ? "bg-danger-soft text-danger" : banner.tone === "warning" ? "bg-warning-soft text-warning" : "bg-accent-soft text-[#9db9ff]"}`}>
            {banner.text} <Link href="/app/settings/billing" className="font-medium underline underline-offset-2"><Tr>Manage billing</Tr></Link>
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
