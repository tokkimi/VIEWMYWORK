import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

export const FEATURE_KEYS = {
  custom_branding: "Custom branding",
  advanced_stats: "Advanced statistics",
  accounting_exports: "Accounting exports",
  advanced_permissions: "Advanced permissions",
  advanced_portal: "Advanced client portal options",
  google_drive: "Google Drive integration",
  online_payments: "Online invoice payments",
  priority_support: "Priority support",
  team_workload: "Team workload planning",
  portfolio_health: "Project health & portfolio steering",
} as const;
export type FeatureKey = keyof typeof FEATURE_KEYS;

export async function getWorkspacePlan(workspaceId: string) {
  const sub = await db.subscription.findUnique({ where: { workspaceId }, include: { plan: { include: { features: true } } } });
  if (!sub) return null;
  const now = new Date();
  const trialExpired = sub.status === "TRIALING" && sub.trialEndsAt !== null && sub.trialEndsAt < now;
  const active = (sub.status === "ACTIVE" || sub.status === "PAST_DUE" || (sub.status === "TRIALING" && !trialExpired));
  return { sub, plan: sub.plan, active, trialExpired, features: new Set(sub.plan.features.filter((f) => f.enabled).map((f) => f.key)) };
}

export async function hasFeature(workspaceId: string, key: FeatureKey) {
  const p = await getWorkspacePlan(workspaceId);
  return Boolean(p?.active && p.features.has(key));
}

export async function requireFeature(workspaceId: string, key: FeatureKey) {
  if (!(await hasFeature(workspaceId, key))) throw new AppError(["{feature} is not included in your current plan.", { feature: { t: FEATURE_KEYS[key] } }], "LIMIT");
}

/** Blocks writes when the subscription is inactive (trial expired / canceled). Reads stay available. */
export async function requireActiveSubscription(workspaceId: string) {
  const p = await getWorkspacePlan(workspaceId);
  if (!p || !p.active) throw new AppError("Your subscription is inactive. Choose a plan in Settings → Billing to continue.", "LIMIT");
  return p;
}

type Limit = "projects" | "clients" | "collaborators";

/** Server-side quota enforcement; limits come from the admin-configurable Plan. */
export async function assertWithinLimit(workspaceId: string, limit: Limit) {
  const p = await requireActiveSubscription(workspaceId);
  const max = limit === "projects" ? p.plan.activeProjectLimit : limit === "clients" ? p.plan.clientLimit : p.plan.collaboratorLimit;
  if (max === null || max === undefined) return;
  let count = 0;
  if (limit === "projects") count = await db.project.count({ where: { workspaceId, archivedAt: null, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } });
  if (limit === "clients") count = await db.client.count({ where: { workspaceId, archivedAt: null } });
  if (limit === "collaborators") {
    const members = await db.workspaceMember.count({ where: { workspaceId, status: "ACTIVE", role: { not: "OWNER" } } });
    const pending = await db.invitation.count({ where: { workspaceId, kind: "MEMBER", acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
    count = members + pending;
  }
  if (count >= max) {
    const label = limit === "projects" ? "active projects" : limit;
    throw new AppError(["Your {plan} plan includes up to {max} {label}. Upgrade in Settings → Billing to add more.", { plan: p.plan.name, max, label: { t: label } }], "LIMIT");
  }
}

export async function storageQuota(workspaceId: string) {
  const [ws, p] = await Promise.all([db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { storageUsedBytes: true } }), getWorkspacePlan(workspaceId)]);
  const limitBytes = p?.plan.storageLimitMb === null || p?.plan.storageLimitMb === undefined ? null : BigInt(p.plan.storageLimitMb) * 1024n * 1024n;
  return { used: ws.storageUsedBytes, limit: limitBytes };
}

export { formatBytes } from "./format-bytes";
