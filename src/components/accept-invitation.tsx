"use client";

import { Button } from "@/components/ui/button";
import { useActionButton } from "@/components/app/invoice-actions";
import { acceptInvitationAction } from "@/server/actions/team";

export function AcceptInvitation({ token }: { token: string }) {
  const { pending, run } = useActionButton();
  return (
    <Button variant="primary" size="lg" className="w-full" disabled={pending} onClick={() => run(() => acceptInvitationAction(token))}>
      {pending ? "Joining…" : "Accept invitation"}
    </Button>
  );
}
