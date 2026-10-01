import { LEGAL } from "@/lib/legal";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getI18n } from "@/lib/i18n/server";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const { t } = await getI18n();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label={t("Main")}>
          <Logo />
          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <Link href="/features" className="hover:text-fg">{t("Features")}</Link>
            <Link href="/pricing" className="hover:text-fg">{t("Pricing")}</Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="mr-1" />
            {user ? (
              <ButtonLink href="/app" variant="primary" size="sm">Open app</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">Sign in</ButtonLink>
                <ButtonLink href="/signup" variant="primary" size="sm">Start free</ButtonLink>
              </>
            )}
          </div>
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <div className="flex flex-wrap gap-6">
            <Link href="/features" className="hover:text-fg">{t("Features")}</Link>
            <Link href="/pricing" className="hover:text-fg">{t("Pricing")}</Link>
            <Link href="/terms" className="hover:text-fg">{t("Terms of use")}</Link>
            <Link href="/cgv" className="hover:text-fg">{t("Terms of sale")}</Link>
            <Link href="/privacy" className="hover:text-fg">{t("Privacy")}</Link>
            <Link href="/legal" className="hover:text-fg">{t("Legal notice")}</Link>
          </div>
          <p className="text-xs text-subtle">© {new Date().getFullYear()} FollowMyFuture · {LEGAL.company} · {t("Switzerland")}</p>
        </div>
      </footer>
    </div>
  );
}
