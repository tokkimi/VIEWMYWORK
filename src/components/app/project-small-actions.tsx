"use client";

import { Check, Trash2 } from "lucide-react";
import { useActionButton } from "./invoice-actions";
import { resolveClientWaitAction, deleteProjectUpdateAction, deleteCalendarEventAction } from "@/server/actions/projects";
import { Tr, useI18n } from "@/lib/i18n/client";

export function ResolveWaitButton({ id }: { id: string }) {
  const { pending, run } = useActionButton();
  return (
    <button disabled={pending} onClick={() => run(() => resolveClientWaitAction(id))} className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-fg">
      <Check className="size-3" /><Tr>Received</Tr>
    </button>
  );
}

export function DeleteUpdateButton({ id }: { id: string }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <button aria-label={t("Delete update")} disabled={pending} onClick={() => confirm(t("Delete this update?")) && run(() => deleteProjectUpdateAction(id))} className="rounded p-1 text-subtle hover:text-danger">
      <Trash2 className="size-3.5" />
    </button>
  );
}

export function DeleteEventButton({ id }: { id: string }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <button aria-label={t("Delete meeting")} disabled={pending} onClick={() => confirm(t("Delete this meeting?")) && run(() => deleteCalendarEventAction(id))} className="rounded p-1 text-subtle hover:text-danger">
      <Trash2 className="size-3.5" />
    </button>
  );
}
