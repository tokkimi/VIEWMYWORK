import Link from "next/link";
import { ForgotForm } from "@/components/auth/auth-forms";
import { Tr } from "@/lib/i18n/client";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Forgot password");

export default function Forgot() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight"><Tr>Reset your password</Tr></h1>
      <p className="mt-1.5 text-sm text-muted"><Tr>Enter your email and we&apos;ll send you a reset link.</Tr></p>
      <div className="mt-8"><ForgotForm /></div>
      <p className="mt-8 text-center text-sm text-muted"><Link href="/login" className="hover:text-fg"><Tr>Back to sign in</Tr></Link></p>
    </>
  );
}
