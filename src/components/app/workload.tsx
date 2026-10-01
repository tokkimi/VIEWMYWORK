"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarOff, Gauge, Sparkles, Trash2, UserCheck } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, Field, Input, Select, Submit } from "@/components/ui/form";
import { useActionButton } from "./invoice-actions";
import { updateMemberCapacityAction, addAbsenceAction, deleteAbsenceAction, assignTasksAction } from "@/server/actions/workload";
import { Tr, useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

export const ABSENCE_REASONS = { LEAVE: "Leave", SICK: "Sick leave", TRAINING: "Training", OTHER: "Other" } as const;

export function CapacityDialog({ memberId, name, hours, hourlyCost }: { memberId: string; name: string; hours: number; hourlyCost: number | null }) {
  const { t } = useI18n();
  return (
    <Dialog title={t("Capacity of {name}", { name })} description={t("Hours available per week and internal cost, used for workload and profitability.")} trigger={(open) => <button type="button" onClick={open} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-white/[0.05] hover:text-fg" aria-label={t("Edit capacity")}><Gauge className="size-3.5" />{t("{h} h/wk", { h: hours })}</button>}>
      {(close) => (
        <Form action={updateMemberCapacityAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="memberId" value={memberId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hours per week" name="hoursPerWeek" hint="e.g. 35, or 20 for part-time"><Input name="hoursPerWeek" type="number" min={0} max={80} step={0.5} defaultValue={hours} required /></Field>
            <Field label="Internal cost per hour" name="hourlyCost" optional hint="Used to compute real project costs"><Input name="hourlyCost" inputMode="decimal" defaultValue={hourlyCost ?? ""} placeholder="45" /></Field>
          </div>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Save</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function AbsenceDialog({ memberId, name, absences, canEdit }: { memberId: string; name: string; absences: { id: string; startDate: string; endDate: string; reason: string; note: string | null }[]; canEdit: boolean }) {
  const { t, fmt } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <Dialog title={t("Absences of {name}", { name })} description={t("Absences reduce the capacity counted in the team workload.")} trigger={(open) => <button type="button" onClick={open} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-white/[0.05] hover:text-fg"><CalendarOff className="size-3.5" />{absences.length ? t("{n} absence(s)", { n: absences.length }) : t("Absences")}</button>}>
      {() => (
        <div className="space-y-5">
          {absences.length > 0 ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {absences.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">{fmt.date(a.startDate)} → {fmt.date(a.endDate)} <span className="text-muted">· {t(ABSENCE_REASONS[a.reason as keyof typeof ABSENCE_REASONS] ?? "Other")}</span>{a.note && <span className="block truncate text-xs text-subtle">{a.note}</span>}</span>
                  {canEdit && <button type="button" disabled={pending} onClick={() => run(() => deleteAbsenceAction(a.id))} aria-label={t("Remove")} className="rounded p-1 text-subtle hover:text-danger"><Trash2 className="size-3.5" /></button>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted"><Tr>No upcoming absence.</Tr></p>}
          {canEdit && (
            <Form action={addAbsenceAction} resetOnSuccess className="space-y-3 border-t border-line pt-4">
              <input type="hidden" name="memberId" value={memberId} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From" name="startDate"><Input name="startDate" type="date" required /></Field>
                <Field label="To" name="endDate"><Input name="endDate" type="date" required /></Field>
                <Field label="Reason" name="reason"><Select name="reason" defaultValue="LEAVE">{Object.entries(ABSENCE_REASONS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
                <Field label="Note" name="note" optional><Input name="note" maxLength={200} /></Field>
              </div>
              <div className="flex justify-end"><Submit size="sm"><Tr>Add absence</Tr></Submit></div>
            </Form>
          )}
        </div>
      )}
    </Dialog>
  );
}

type Row = { taskId: string; title: string; projectId: string; projectName: string; deadline: string | null; remaining: number; suggested: string | null };

/** Unassigned tasks with a suggested assignee (most free capacity in the due week, with access to the project). */
export function UnassignedTasks({ rows, members }: { rows: Row[]; members: { userId: string; name: string }[] }) {
  const { t, fmt } = useI18n();
  const { pending, run } = useActionButton();
  const [choice, setChoice] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.taskId, r.suggested ?? ""])));
  const ready = rows.filter((r) => choice[r.taskId]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (
    <div className="space-y-3">
      {ready.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><Sparkles className="size-4 text-accent" />{t("{n} task(s) ready to assign according to each person's free capacity.", { n: ready.length })}</span>
          <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => assignTasksAction(ready.map((r) => ({ taskId: r.taskId, userId: choice[r.taskId]! }))))}><UserCheck className="size-3.5" />{t("Assign all")}</Button>
        </div>
      )}
      <ul className="panel divide-y divide-line rounded-2xl">
        {rows.map((r) => {
          const late = r.deadline && new Date(r.deadline) < today;
          return (
            <li key={r.taskId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1 basis-56">
                <Link href={`/app/projects/${r.projectId}/tasks?task=${r.taskId}`} className="block truncate hover:underline">{r.title}</Link>
                <div className="truncate text-xs text-muted">{r.projectName} · <span className={cn(late && "text-danger")}>{r.deadline ? fmt.short(r.deadline) : t("No deadline")}</span> · {t("{h} h left", { h: Math.round((r.remaining / 60) * 10) / 10 })}</div>
              </div>
              <select aria-label={t("Assignee")} value={choice[r.taskId] ?? ""} onChange={(e) => setChoice((c) => ({ ...c, [r.taskId]: e.target.value }))} className="h-8 max-w-[180px] rounded-lg border border-line bg-transparent px-2 text-xs">
                <option value="">{t("Choose…")}</option>
                {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}{m.userId === r.suggested ? ` ★` : ""}</option>)}
              </select>
              <Button size="sm" disabled={pending || !choice[r.taskId]} onClick={() => run(() => assignTasksAction([{ taskId: r.taskId, userId: choice[r.taskId]! }]))}><Tr>Assign</Tr></Button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-subtle"><Tr>★ = suggestion: the person with access to the project who has the most free time in the week the task is due.</Tr></p>
    </div>
  );
}
