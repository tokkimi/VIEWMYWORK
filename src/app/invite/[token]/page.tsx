import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { getSessionUser } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { AcceptInvitation } from "@/components/accept-invitation";
import { logoutAction } from "@/server/actions/auth";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Invitation", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { t } = await getI18n();
  const { token } = await params;
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) }, include: { workspace: { select: { name: true, logoUrl: true } } } });
  const user = await getSessionUser();
  const valid = inv && !inv.revokedAt && !inv.acceptedAt && inv.expiresAt > new Date();
  const next = `/invite/${token}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 py-6"><Logo /></header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-10">
        <div className="glass w-full max-w-md rounded-2xl p-8 text-center">
          {!valid ? (
            <>
              <h1 className="text-xl font-semibold"><Tr>Invitation unavailable</Tr></h1>
              <p className="mt-2 text-sm text-muted"><Tr>This invitation is invalid, was already used, or has expired. Ask the sender for a new one.</Tr></p>
              <ButtonLink href="/login" className="mt-6"><Tr>Go to sign in</Tr></ButtonLink>
            </>
          ) : (
            <>
              <div className="eyebrow">{inv.workspace.name}</div>
              <h1 className="mt-3 text-xl font-semibold">{inv.kind === "CLIENT" ? t("Your project portal is ready") : t("Join {workspace}", { workspace: inv.workspace.name })}</h1>
              <p className="mt-2 text-sm text-muted">
                {inv.kind === "CLIENT" ? t("Follow progress, review deliverables, access files and pay invoices in one place.") : t("You're invited as {role}.", { role: inv.title || (inv.role ? t(ROLE_LABELS[inv.role]) : t("a collaborator")) })}
              </p>
              {inv.email && <p className="mt-4 text-xs text-subtle"><Tr>Invitation for</Tr> {inv.email}</p>}
              <div className="mt-6">
                {!user ? (
                  <div className="space-y-2">
                    <ButtonLink href={`/signup?${inv.email ? `email=${encodeURIComponent(inv.email)}&` : ""}next=${encodeURIComponent(next)}`} variant="primary" className="w-full"><Tr>Create account & accept</Tr></ButtonLink>
                    <ButtonLink href={`/login?${inv.email ? `email=${encodeURIComponent(inv.email)}&` : ""}next=${encodeURIComponent(next)}`} variant="ghost" className="w-full"><Tr>I already have an account</Tr></ButtonLink>
                  </div>
                ) : inv.email && user.email.toLowerCase() !== inv.email.toLowerCase() ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-warning">{t("You're signed in as {email}. Sign in with {invited} to accept.", { email: user.email, invited: inv.email })}</p>
                    <form action={logoutAction}><button className="text-muted underline"><Tr>Sign out</Tr></button></form>
                  </div>
                ) : !user.emailVerifiedAt ? (
                  <ButtonLink href="/verify-email" variant="primary" className="w-full"><Tr>Verify your email first</Tr></ButtonLink>
                ) : (
                  <AcceptInvitation token={token} />
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
