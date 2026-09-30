"use client";

import Link from "next/link";
import { Form, Field, Input, Submit } from "@/components/ui/form";
import { signupAction, loginAction, forgotPasswordAction, resetPasswordAction, resendVerificationAction } from "@/server/actions/auth";

const toRedirect = (d: unknown) => (d as { redirect?: string } | null)?.redirect;

export function LoginForm({ next, email }: { next?: string; email?: string }) {
  return (
    <Form action={loginAction} redirectTo={toRedirect} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" name="email"><Input name="email" type="email" autoComplete="email" defaultValue={email} required autoFocus /></Field>
      <Field label="Password" name="password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end text-xs"><Link href="/forgot-password" className="text-muted hover:text-fg">Forgot password?</Link></div>
      <Submit className="w-full" size="lg">Sign in</Submit>
    </Form>
  );
}

export function SignupForm({ next, email }: { next?: string; email?: string }) {
  return (
    <Form action={signupAction} redirectTo={toRedirect} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Full name" name="name"><Input name="name" autoComplete="name" required autoFocus /></Field>
      <Field label="Work email" name="email"><Input name="email" type="email" autoComplete="email" defaultValue={email} required /></Field>
      <Field label="Password" name="password" hint="At least 10 characters."><Input name="password" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <Submit className="w-full" size="lg">Create account</Submit>
      <p className="text-center text-xs text-subtle">By continuing you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>.</p>
    </Form>
  );
}

export function ForgotForm() {
  return (
    <Form action={forgotPasswordAction} className="space-y-4" resetOnSuccess>
      <Field label="Email" name="email"><Input name="email" type="email" autoComplete="email" required autoFocus /></Field>
      <Submit className="w-full" size="lg">Send reset link</Submit>
    </Form>
  );
}

export function ResetForm({ token }: { token: string }) {
  return (
    <Form action={resetPasswordAction} redirectTo={toRedirect} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" hint="At least 10 characters."><Input name="password" type="password" autoComplete="new-password" required autoFocus /></Field>
      <Submit className="w-full" size="lg">Update password</Submit>
    </Form>
  );
}

export function ResendVerification() {
  return (
    <Form action={async () => resendVerificationAction()} redirectTo={toRedirect}>
      <Submit variant="secondary" className="w-full">Resend verification email</Submit>
    </Form>
  );
}
