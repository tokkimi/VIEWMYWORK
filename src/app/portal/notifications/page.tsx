import { requirePortal } from "@/lib/auth/portal";
import { NotificationList } from "@/components/notification-list";
import { pageTitle } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Notifications");

export default async function PortalNotifications({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const ctx = await requirePortal();
  const sp = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight"><Tr>Notifications</Tr></h1>
      <NotificationList userId={ctx.user.id} filter={sp.filter} page={Number(sp.page) || 1} base="/portal/notifications" />
    </>
  );
}
