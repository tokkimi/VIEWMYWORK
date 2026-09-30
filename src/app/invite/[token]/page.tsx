import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { getSessionUser } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { AcceptInvitation } from "@/components/accept-invitation";
import { logoutAction } from "@/server/actions/auth";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export const metadata = { title: "Invitation", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
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
              <h1 className="text-xl font-semibold">Invitation unavailable</h1>
              <p className="mt-2 text-sm text-muted">This invitation is invalid, was already used, or has expired. Ask the sender for a new one.</p>
              <ButtonLink href="/login" className="mt-6">Go to sign in</ButtonLink>
            </>
          ) : (
            <>
              <div className="eyebrow">{inv.workspace.name}</div>
              <h1 className="mt-3 text-xl font-semibold">{inv.kind === "CLIENT" ? "Your project portal is ready" : `Join ${inv.workspace.name}`}</h1>
              <p className="mt-2 text-sm text-muted">
                {inv.kind === "CLIENT" ? "Follow progress, review deliverables, access files and pay invoices in one place." : `You're invited as ${inv.title || (inv.role ? ROLE_LABELS[inv.role] : "a collaborator")}.`}
              </p>
              <p className="mt-4 text-xs text-subtle">Invitation for {inv.email}</p>
              <div className="mt-6">
                {!user ? (
                  <div className="space-y-2">
                    <ButtonLink href={`/signup?email=${encodeURIComponent(inv.email)}&next=${encodeURIComponent(next)}`} variant="primary" className="w-full">Create account & accept</ButtonLink>
                    <ButtonLink href={`/login?email=${encodeURIComponent(inv.email)}&next=${encodeURIComponent(next)}`} variant="ghost" className="w-full">I already have an account</ButtonLink>
                  </div>
                ) : user.email.toLowerCase() !== inv.email.toLowerCase() ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-warning">You&apos;re signed in as {user.email}. Sign in with {inv.email} to accept.</p>
                    <form action={logoutAction}><button className="text-muted underline">Sign out</button></form>
                  </div>
                ) : !user.emailVerifiedAt ? (
                  <ButtonLink href="/verify-email" variant="primary" className="w-full">Verify your email first</ButtonLink>
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
