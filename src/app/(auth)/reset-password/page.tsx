import Link from "next/link";
import { ResetForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Choose a new password" };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      {token ? (
        <div className="mt-8"><ResetForm token={token} /></div>
      ) : (
        <p className="mt-4 text-sm text-muted">This link is missing its token. <Link href="/forgot-password" className="text-fg underline">Request a new one</Link>.</p>
      )}
    </>
  );
}
