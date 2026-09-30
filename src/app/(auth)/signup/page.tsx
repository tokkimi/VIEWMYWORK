import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create your account" };

export default async function Signup({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; plan?: string }> }) {
  const sp = await searchParams;
  const next = sp.next ?? (sp.plan ? `/onboarding?plan=${encodeURIComponent(sp.plan)}` : undefined);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Start free</h1>
      <p className="mt-1.5 text-sm text-muted">Give your clients a portal they&apos;ll actually use.</p>
      <div className="mt-8"><SignupForm next={next} email={sp.email} /></div>
      <p className="mt-8 text-center text-sm text-muted">Already have an account? <Link href={`/login${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="text-fg hover:underline">Sign in</Link></p>
    </>
  );
}
