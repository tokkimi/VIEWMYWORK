"use client";

import { Button } from "@/components/ui/button";
import { useActionButton } from "@/components/app/invoice-actions";
import { acceptInvitationAction } from "@/server/actions/team";
import { useI18n } from "@/lib/i18n/client";

export function AcceptInvitation({ token }: { token: string }) {
  const { pending, run } = useActionButton();
  const { t } = useI18n();
  return (
    <Button variant="primary" size="lg" className="w-full" disabled={pending} onClick={() => run(() => acceptInvitationAction(token))}>
      {pending ? t("Joining…") : t("Accept invitation")}
    </Button>
  );
}
