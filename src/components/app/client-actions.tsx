"use client";

import { Archive, ArchiveRestore, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionButton } from "./invoice-actions";
import { archiveClientAction, revokePortalAccessAction, removeClientContactAction } from "@/server/actions/clients";
import { Tr, useI18n } from "@/lib/i18n/client";

export function ArchiveClientButton({ id, archived }: { id: string; archived: boolean }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => (archived || confirm(t("Archive this client? Their projects, invoices and history are kept."))) && run(() => archiveClientAction(id, !archived))}>
      {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
      {archived ? t("Restore client") : t("Archive client")}
    </Button>
  );
}

export function RevokeAccessButton({ id }: { id: string }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => confirm(t("Revoke portal access for this person?")) && run(() => revokePortalAccessAction(id))}>
      <Tr>Revoke</Tr>
    </Button>
  );
}

export function RemoveContactButton({ id }: { id: string }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <button aria-label={t("Remove contact")} disabled={pending} onClick={() => run(() => removeClientContactAction(id))} className="rounded p-1 text-subtle hover:text-danger">
      <X className="size-3.5" />
    </button>
  );
}
