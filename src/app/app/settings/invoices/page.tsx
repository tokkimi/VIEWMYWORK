import { db } from "@/lib/db";
import { requireWorkspace, requirePerm } from "@/lib/auth/context";
import { InvoiceSettingsForm } from "@/components/app/settings-forms";

export const metadata = { title: "Invoice settings" };

export default async function InvoiceSettingsPage() {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "settings", "manage");
  const s = await db.invoiceSettings.upsert({ where: { workspaceId: ctx.workspace.id }, create: { workspaceId: ctx.workspace.id, defaultCurrency: ctx.workspace.defaultCurrency }, update: {} });
  return <InvoiceSettingsForm s={s} />;
}
