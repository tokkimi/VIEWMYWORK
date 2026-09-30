import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth/context";
import { TOPIC_LABELS, type Topic } from "@/lib/events";
import { PreferencesForm } from "@/components/preferences-form";
import { pageTitle } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Notification preferences");

export default async function NotificationSettings() {
  const ctx = await requireWorkspace();
  const prefs = await db.notificationPreference.findMany({ where: { userId: ctx.user.id } });
  const by = new Map(prefs.map((p) => [p.topic, p]));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted"><Tr>Choose how you&apos;re notified. These settings are personal.</Tr></p>
      <PreferencesForm topics={(Object.keys(TOPIC_LABELS) as Topic[]).map((k) => ({ key: k, label: TOPIC_LABELS[k], inApp: by.get(k)?.inApp ?? true, email: by.get(k)?.email ?? true }))} />
    </div>
  );
}
