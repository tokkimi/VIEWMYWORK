"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/toast";

async function markRead(body: object) {
  await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function MarkAllRead() {
  const router = useRouter();
  const { t } = useI18n();
  return <Button size="sm" variant="ghost" onClick={async () => { await markRead({ all: true }); router.refresh(); }}>{t("Mark all as read")}</Button>;
}

export function NotificationLink({ id, href, unread, children }: { id: string; href: string | null; unread: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      onClick={async () => {
        if (unread) await markRead({ ids: [id] });
        if (href) router.push(href);
        else {
          toast.success("Nothing linked yet");
          router.refresh();
        }
      }}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02]"
    >
      {children}
    </button>
  );
}
