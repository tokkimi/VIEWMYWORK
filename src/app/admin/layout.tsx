import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/context";
import { AdminNav } from "@/components/admin/nav";
import { LogoMark } from "@/components/logo";
import { Tr } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: { default: t("Platform administration"), template: `%s · ${t("Admin")}` }, robots: { index: false } };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();
  return (
    <div className="min-h-dvh lg:pl-[232px]">
      <aside className="border-b border-line bg-surface/60 lg:fixed lg:inset-y-0 lg:left-0 lg:w-[232px] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold"><LogoMark className="size-5" /><Tr>Platform admin</Tr></span>
          <Link href="/app" className="text-xs text-muted hover:text-fg"><Tr>My workspace →</Tr></Link>
        </div>
        <AdminNav />
        <div className="hidden space-y-2 px-4 py-4 text-[11px] text-subtle lg:absolute lg:bottom-0 lg:block"><LanguageSwitcher /><div><Tr>Signed in as</Tr> {user.email}</div></div>
      </aside>
      <main id="main" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
