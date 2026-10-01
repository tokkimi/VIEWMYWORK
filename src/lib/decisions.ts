/** Client decision center — shared types and the (pure, unit-tested) reminder rule. */

export type DecisionKind = "APPROVAL" | "DOCUMENT" | "INFORMATION" | "PAYMENT" | "SCOPE" | "OTHER";

export const DECISION_LABEL: Record<DecisionKind, string> = {
  APPROVAL: "Approval",
  DOCUMENT: "Document",
  INFORMATION: "Information",
  PAYMENT: "Payment",
  SCOPE: "Scope decision",
  OTHER: "Other",
};

export type DecisionItem = {
  key: string; // "deliverable:<id>" | "wait:<id>" | "scope:<id>" | "invoice:<id>"
  kind: DecisionKind;
  title: string;
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectName: string | null;
  since: Date;
  href: string; // professional side
  portalHref: string; // client side
  amount?: { cents: number; currency: string };
  reminders: number;
  lastReminderAt: Date | null;
};

export type ReminderSettings = { enabled: boolean; firstDays: number; everyDays: number; max: number };
export const DEFAULT_REMINDERS: ReminderSettings = { enabled: true, firstDays: 3, everyDays: 4, max: 3 };

const DAY = 86_400_000;
export const ageDays = (since: Date, now = new Date()) => Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY));

/**
 * Should an automatic reminder go out for this item today?
 * Invoices are excluded: they have their own payment-reminder schedule.
 */
export function reminderDue(item: Pick<DecisionItem, "kind" | "since" | "reminders" | "lastReminderAt">, s: ReminderSettings, now = new Date()) {
  if (!s.enabled || item.kind === "PAYMENT") return false;
  if (item.reminders >= s.max) return false;
  if (ageDays(item.since, now) < s.firstDays) return false;
  if (item.lastReminderAt && now.getTime() - item.lastReminderAt.getTime() < s.everyDays * DAY - 2 * 3600_000) return false;
  return true;
}

/** A manual reminder is allowed at most once a day per item (protects the client's inbox). */
export function manualReminderAllowed(lastReminderAt: Date | null, now = new Date()) {
  return !lastReminderAt || now.getTime() - lastReminderAt.getTime() >= 20 * 3600_000;
}
