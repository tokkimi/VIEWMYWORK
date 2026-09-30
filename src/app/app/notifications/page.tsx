import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { NotificationList } from "@/components/notification-list";

export const metadata = { title: "Notifications" };

export default async function Notifications({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Notifications" actions={<Link href="/app/settings/notifications" className="text-sm text-muted hover:text-fg">Preferences</Link>} />
      <NotificationList userId={ctx.user.id} filter={sp.filter} page={Math.max(1, Number(sp.page) || 1)} base="/app/notifications" />
    </>
  );
}
