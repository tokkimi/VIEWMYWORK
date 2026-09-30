import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { WORKSPACE_COOKIE } from "@/lib/auth/context";
import { PORTAL_COOKIE } from "@/lib/auth/portal";
import type { WorkspaceRole } from "@prisma/client";
import { cookieJar } from "./setup";

let n = 0;
const uid = () => `${Date.now()}${++n}${Math.random().toString(36).slice(2, 6)}`;

export async function plan() {
  return (await db.plan.findFirst({ where: { code: "TEST" } })) ?? db.plan.create({ data: { code: "TEST", name: "Test", monthlyPriceCents: 200, features: { create: [{ key: "online_payments" }, { key: "accounting_exports" }] } } });
}

export async function makeUser(name = "User") {
  return db.user.create({ data: { name, email: `${uid()}@test.dev`, emailVerifiedAt: new Date() } });
}

export async function makeWorkspace(ownerName = "Owner") {
  const owner = await makeUser(ownerName);
  const p = await plan();
  const ws = await db.workspace.create({ data: { name: `WS ${uid()}`, slug: `ws-${uid()}`, onboardingDone: true } });
  const member = await db.workspaceMember.create({ data: { workspaceId: ws.id, userId: owner.id, role: "OWNER", allProjects: true } });
  await db.subscription.create({ data: { workspaceId: ws.id, planId: p.id, status: "ACTIVE", priceCents: 200, currency: "EUR" } });
  const client = await db.client.create({ data: { workspaceId: ws.id, firstName: "Cli", lastName: "Ent", email: `${uid()}@client.dev` } });
  const project = await db.project.create({ data: { workspaceId: ws.id, clientId: client.id, name: "Proj", managerId: owner.id } });
  return { ws, owner, member, client, project };
}

export async function addMember(workspaceId: string, role: WorkspaceRole, opts: { permissions?: object; projectIds?: string[] } = {}) {
  const user = await makeUser(role);
  const m = await db.workspaceMember.create({ data: { workspaceId, userId: user.id, role, permissions: opts.permissions } });
  for (const projectId of opts.projectIds ?? []) await db.projectMember.create({ data: { projectId, memberId: m.id } });
  return { user, member: m };
}

/** Signs a user in for subsequent server-action calls (real session row + cookie). */
export async function signIn(userId: string, extra: { workspaceId?: string; portalClientId?: string } = {}) {
  cookieJar.clear();
  const token = randomToken();
  await db.session.create({ data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) } });
  cookieJar.set(SESSION_COOKIE, token);
  if (extra.workspaceId) cookieJar.set(WORKSPACE_COOKIE, extra.workspaceId);
  if (extra.portalClientId) cookieJar.set(PORTAL_COOKIE, extra.portalClientId);
}

export function fd(o: Record<string, string | number | boolean | undefined>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) if (v !== undefined) f.set(k, String(v));
  return f;
}
