import { Badge } from "@/components/ui/primitives";
import { TASK_STATUS, DELIVERABLE_STATUS, PROJECT_STATUS, INVOICE_STATUS, PRIORITY, PAYMENT_STATUS } from "@/lib/labels";
import type { TaskStatus, DeliverableStatus, ProjectStatus, InvoiceStatus, Priority, PaymentStatus } from "@prisma/client";

export const TaskStatusBadge = ({ s }: { s: TaskStatus }) => <Badge tone={TASK_STATUS[s].tone} dot>{TASK_STATUS[s].label}</Badge>;
export const DeliverableStatusBadge = ({ s }: { s: DeliverableStatus }) => <Badge tone={DELIVERABLE_STATUS[s].tone} dot>{DELIVERABLE_STATUS[s].label}</Badge>;
export const ProjectStatusBadge = ({ s }: { s: ProjectStatus }) => <Badge tone={PROJECT_STATUS[s].tone}>{PROJECT_STATUS[s].label}</Badge>;
export const InvoiceStatusBadge = ({ s }: { s: InvoiceStatus }) => <Badge tone={INVOICE_STATUS[s].tone}>{INVOICE_STATUS[s].label}</Badge>;
export const PriorityBadge = ({ p }: { p: Priority }) => (p === "MEDIUM" || p === "LOW" ? null : <Badge tone={PRIORITY[p].tone}>{PRIORITY[p].label}</Badge>);
export const PaymentStatusBadge = ({ s }: { s: PaymentStatus }) => <Badge tone={PAYMENT_STATUS[s].tone}>{PAYMENT_STATUS[s].label}</Badge>;
