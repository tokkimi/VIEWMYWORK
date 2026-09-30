import { db } from "@/lib/db";
import { requireWorkspace, requirePerm } from "@/lib/auth/context";
import { hasFeature } from "@/lib/plans";
import { BrandingForm } from "@/components/app/settings-forms";

export const metadata = { title: "Branding" };

export default async function Branding() {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "settings", "manage");
  const [s, custom] = await Promise.all([db.workspaceSetting.findUnique({ where: { workspaceId: ctx.workspace.id } }), hasFeature(ctx.workspace.id, "custom_branding")]);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Your logo appears in the client portal, emails and invoices. Custom domains and white-label portals are planned for a future release.</p>
      <BrandingForm logoUrl={ctx.workspace.logoUrl} portalLogoUrl={s?.portalLogoUrl ?? null} invoiceLogoUrl={s?.invoiceLogoUrl ?? null} canCustom={custom} />
    </div>
  );
}
