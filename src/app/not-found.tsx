import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="num text-sm text-subtle">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-sm text-muted">Or you don&apos;t have access to it.</p>
      <ButtonLink href="/" variant="secondary" className="mt-6">Go home</ButtonLink>
    </main>
  );
}
