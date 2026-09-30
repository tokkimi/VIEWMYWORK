import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-forms";
import { Tr } from "@/lib/i18n/client";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Sign in");

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight"><Tr>Welcome back</Tr></h1>
      <p className="mt-1.5 text-sm text-muted"><Tr>Sign in to your workspace or client portal.</Tr></p>
      <div className="mt-8"><LoginForm next={sp.next} email={sp.email} /></div>
      <p className="mt-8 text-center text-sm text-muted"><Tr>New here?</Tr> <Link href={`/signup${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="text-fg hover:underline"><Tr>Create an account</Tr></Link></p>
    </>
  );
}
