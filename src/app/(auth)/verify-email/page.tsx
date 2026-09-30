import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { ResendVerification } from "@/components/auth/auth-forms";
import { logoutAction } from "@/server/actions/auth";
import { Tr } from "@/lib/i18n/client";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Verify your email");

export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ invalid?: string }> }) {
  const user = await getSessionUser();
  const { invalid } = await searchParams;
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirect("/onboarding");
  return (
    <div className="text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-line bg-white/[0.03]"><MailCheck className="size-5 text-accent" /></div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight"><Tr>Check your inbox</Tr></h1>
      <p className="mt-2 text-sm text-muted"><Tr>We sent a verification link to</Tr> <span className="text-fg">{user.email}</span>.</p>
      {invalid && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"><Tr>That link is invalid or expired. Request a new one below.</Tr></p>}
      <div className="mt-8"><ResendVerification /></div>
      <form action={logoutAction} className="mt-4"><button className="text-xs text-muted hover:text-fg"><Tr>Use a different account</Tr></button></form>
    </div>
  );
}
