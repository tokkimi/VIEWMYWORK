import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const title = `FollowMyFuture — ${t("Your clients shouldn't have to ask “Where are we?”")}`;
  const description = t("Manage specifications, progress, deliverables, documents, approvals and invoices from one beautifully simple client portal.");
  return {
    metadataBase: new URL(env.appUrl),
    applicationName: "FollowMyFuture",
    title: { default: title, template: "%s · FollowMyFuture" },
    description,
    openGraph: { type: "website", siteName: "FollowMyFuture", title, description, locale: locale === "fr" ? "fr_FR" : "en_US", url: "/" },
    twitter: { card: "summary_large_image", title, description },
    appleWebApp: { capable: true, title: "FollowMyFuture", statusBarStyle: "black-translucent" },
  };
}

// maximumScale keeps iOS from zooming the page in or out on its own (pinch-to-zoom still works on iOS).
export const viewport: Viewport = { themeColor: "#08090b", width: "device-width", initialScale: 1, maximumScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-white">
          {t("Skip to content")}
        </a>
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
