import { Suspense } from "react";
import { requireWorkspace, can } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { LinkTabs } from "@/components/ui/tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const admin = can(ctx, "settings", "manage");
  const tabs = [
    ...(admin ? [{ href: "/app/settings", label: "General" }, { href: "/app/settings/branding", label: "Branding" }, { href: "/app/settings/invoices", label: "Invoices" }, { href: "/app/settings/payments", label: "Client payments" }] : []),
    ...(ctx.member.role === "OWNER" ? [{ href: "/app/settings/billing", label: "Billing" }] : []),
    ...(admin ? [{ href: "/app/settings/integrations", label: "Integrations" }, { href: "/app/settings/templates", label: "Templates" }, { href: "/app/settings/storage", label: "Storage" }] : []),
    { href: "/app/settings/notifications", label: "Notifications" },
    ...(can(ctx, "team", "view") ? [{ href: "/app/team", label: "Members & permissions" }] : []),
  ];
  return (
    <>
      <PageHeader title="Settings" description={ctx.workspace.name} />
      <Suspense><LinkTabs tabs={tabs} /></Suspense>
      <div className="max-w-3xl">{children}</div>
    </>
  );
}
