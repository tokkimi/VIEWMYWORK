import Link from "next/link";
import { ForgotForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Forgot password" };

export default function Forgot() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>
      <div className="mt-8"><ForgotForm /></div>
      <p className="mt-8 text-center text-sm text-muted"><Link href="/login" className="hover:text-fg">Back to sign in</Link></p>
    </>
  );
}
