import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/auth-forms";
import { Tr } from "@/lib/i18n/client";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Create your account");

export default async function Signup({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; plan?: string }> }) {
  const sp = await searchParams;
  const next = sp.next ?? (sp.plan ? `/onboarding?plan=${encodeURIComponent(sp.plan)}` : undefined);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight"><Tr>Start free</Tr></h1>
      <p className="mt-1.5 text-sm text-muted"><Tr>Give your clients a portal they&apos;ll actually use.</Tr></p>
      <div className="mt-8"><SignupForm next={next} email={sp.email} /></div>
      <p className="mt-8 text-center text-sm text-muted"><Tr>Already have an account?</Tr> <Link href={`/login${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="text-fg hover:underline"><Tr>Sign in</Tr></Link></p>
    </>
  );
}
