import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { NotificationList } from "@/components/notification-list";
import { pageTitle } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Notifications");

export default async function Notifications({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Notifications" actions={<Link href="/app/settings/notifications" className="text-sm text-muted hover:text-fg"><Tr>Preferences</Tr></Link>} />
      <NotificationList userId={ctx.user.id} filter={sp.filter} page={Math.max(1, Number(sp.page) || 1)} base="/app/notifications" />
    </>
  );
}
