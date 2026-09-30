import Link from "next/link";
import { ResetForm } from "@/components/auth/auth-forms";
import { Tr } from "@/lib/i18n/client";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Choose a new password");

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight"><Tr>Choose a new password</Tr></h1>
      {token ? (
        <div className="mt-8"><ResetForm token={token} /></div>
      ) : (
        <p className="mt-4 text-sm text-muted"><Tr>This link is missing its token.</Tr> <Link href="/forgot-password" className="text-fg underline"><Tr>Request a new one</Tr></Link>.</p>
      )}
    </>
  );
}
