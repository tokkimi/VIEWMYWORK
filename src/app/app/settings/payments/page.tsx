import { db } from "@/lib/db";
import { requireWorkspace, requirePerm } from "@/lib/auth/context";
import { integrations } from "@/lib/env";
import { hasFeature } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { StripeConnectPanel } from "@/components/app/settings-forms";
import { pageTitle } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Payments");

export default async function PaymentsSettings({ searchParams }: { searchParams: Promise<{ return?: string }> }) {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "settings", "manage");
  const sp = await searchParams;
  let acct = await db.paymentAccount.findUnique({ where: { workspaceId: ctx.workspace.id } });
  // Returning from Stripe onboarding: sync the account state once (webhook will also update it).
  if (sp.return && acct && integrations.stripe()) {
    try {
      const a = await getStripe().accounts.retrieve(acct.stripeAccountId);
      acct = await db.paymentAccount.update({ where: { workspaceId: ctx.workspace.id }, data: { chargesEnabled: a.charges_enabled, payoutsEnabled: a.payouts_enabled, detailsSubmitted: a.details_submitted } });
    } catch {}
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[15px] font-medium"><Tr>Client invoice payments</Tr></h2>
        <p className="mt-1 text-sm text-muted"><Tr>Client invoice payments go straight to your own Stripe account (Stripe Connect). They are completely separate from your FollowMyFuture subscription.</Tr></p>
      </div>
      <StripeConnectPanel state={acct} configured={integrations.stripe()} allowed={await hasFeature(ctx.workspace.id, "online_payments")} />
      <p className="text-xs text-subtle"><Tr>Manual payments (bank transfer, cash, check) can always be recorded from any invoice.</Tr></p>
    </div>
  );
}
