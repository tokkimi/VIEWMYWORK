"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError } from "@/lib/errors";
import { requireWorkspace, requirePerm, projectScope } from "@/lib/auth/context";
import { formToObject, zId } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { loadDecisions } from "@/server/queries/decisions";
import { sendDecisionReminder } from "@/server/services/decisions";
import { manualReminderAllowed } from "@/lib/decisions";
import { requireFeature } from "@/lib/plans";

/** Remind a client now about some (or all) of their pending items — at most once a day per item. */
export async function remindClientAction(clientId: string, keys?: string[]) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "messages", "send");
    await requireFeature(ctx.workspace.id, "client_decisions");
    await rateLimit("decision-remind", 40, 3600, ctx.workspace.id);
    const id = zId.parse(clientId);
    const all = await loadDecisions(ctx.workspace.id, { ...projectScope(ctx), clientId: id });
    const wanted = all.filter((i) => !keys || keys.includes(i.key));
    if (!wanted.length) throw new AppError("Nothing is waiting for this client anymore.");
    const items = wanted.filter((i) => manualReminderAllowed(i.lastReminderAt));
    if (!items.length) throw new AppError("This client was already reminded in the last 24 hours.");
    const r = await sendDecisionReminder(ctx.workspace.id, id, items, { auto: false, sentById: ctx.user.id });
    if (r.status === "NO_PORTAL") throw new AppError("This client has no portal access yet. Share the portal first (email, WhatsApp or link).");
    if (r.status !== "SENT") throw new AppError("The reminder couldn't be sent.");
    return { items: items.length, emails: r.emails };
  }, "Reminder sent to the client.");
}

export async function saveReminderSettingsAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    const i = z
      .object({
        decisionReminders: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
        reminderFirstDays: z.coerce.number().int().min(1, "Between 1 and 30 days.").max(30, "Between 1 and 30 days."),
        reminderEveryDays: z.coerce.number().int().min(1, "Between 1 and 30 days.").max(30, "Between 1 and 30 days."),
        reminderMax: z.coerce.number().int().min(1, "Between 1 and 10 reminders.").max(10, "Between 1 and 10 reminders."),
      })
      .parse({ decisionReminders: "false", ...formToObject(fd) });
    await db.workspaceSetting.upsert({ where: { workspaceId: ctx.workspace.id }, create: { workspaceId: ctx.workspace.id, ...i }, update: i });
    return null;
  }, "Reminder settings saved.");
}
