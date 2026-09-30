import { ButtonLink } from "@/components/ui/button";
import { Tr } from "@/lib/i18n/client";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="num text-sm text-subtle">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight"><Tr>This page doesn&apos;t exist</Tr></h1>
      <p className="mt-2 text-sm text-muted"><Tr>Or you don&apos;t have access to it.</Tr></p>
      <ButtonLink href="/" variant="secondary" className="mt-6"><Tr>Go home</Tr></ButtonLink>
    </main>
  );
}
