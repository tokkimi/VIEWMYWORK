import type { TaskStatus, DeliverableStatus, ProjectStatus, InvoiceStatus, Priority, PaymentStatus, PaymentMethod } from "@prisma/client";
import { INVOICE_STATUS_LABEL } from "@/lib/invoices/status";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "accent" },
  BLOCKED: { label: "Blocked", tone: "danger" },
  WAITING_FOR_CLIENT: { label: "Waiting for client", tone: "warning" },
  IN_REVIEW: { label: "In review", tone: "accent" },
  COMPLETED: { label: "Completed", tone: "success" },
};
export const TASK_STATUSES = Object.keys(TASK_STATUS) as TaskStatus[];

export const DELIVERABLE_STATUS: Record<DeliverableStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  READY_FOR_REVIEW: { label: "Ready for review", tone: "accent" },
  WAITING_FOR_CLIENT: { label: "Waiting for client", tone: "warning" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "danger" },
  APPROVED: { label: "Approved", tone: "success" },
};

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  PLANNING: { label: "Planning", tone: "neutral" },
  ACTIVE: { label: "Active", tone: "accent" },
  ON_HOLD: { label: "On hold", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: INVOICE_STATUS_LABEL.DRAFT, tone: "neutral" },
  SENT: { label: INVOICE_STATUS_LABEL.SENT, tone: "accent" },
  VIEWED: { label: INVOICE_STATUS_LABEL.VIEWED, tone: "accent" },
  PARTIALLY_PAID: { label: INVOICE_STATUS_LABEL.PARTIALLY_PAID, tone: "warning" },
  PAID: { label: INVOICE_STATUS_LABEL.PAID, tone: "success" },
  OVERDUE: { label: INVOICE_STATUS_LABEL.OVERDUE, tone: "danger" },
  VOID: { label: INVOICE_STATUS_LABEL.VOID, tone: "neutral" },
  REFUNDED: { label: INVOICE_STATUS_LABEL.REFUNDED, tone: "neutral" },
};

export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Medium", tone: "neutral" },
  HIGH: { label: "High", tone: "warning" },
  URGENT: { label: "Urgent", tone: "danger" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "neutral" },
  SUCCEEDED: { label: "Succeeded", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", tone: "warning" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  CARD: "Card",
  STRIPE_OTHER: "Online",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHECK: "Check",
  OTHER: "Other",
};

export const EXPENSE_CATEGORIES = { SOFTWARE: "Software", FREELANCER: "Freelancer", TRAVEL: "Travel", MATERIAL: "Material", ADVERTISING: "Advertising", OTHER: "Other" } as const;

export const PROJECT_TYPES = ["Website", "Mobile Application", "Branding", "Marketing", "Consulting", "Architecture", "Event", "Custom"] as const;

export const FILE_CATEGORIES = { DOCUMENT: "Documents", IMAGE: "Images", CONTRACT: "Contracts", INVOICE: "Invoices", DELIVERABLE: "Deliverables", OTHER: "Other" } as const;
