import type { WorkspaceRole } from "@prisma/client";

// Capability levels ordered from least to most privileged.
export const CAPABILITIES = {
  projects: ["none", "view", "edit", "manage"],
  tasks: ["none", "view", "edit"],
  files: ["none", "view", "upload"],
  clients: ["none", "view", "edit"],
  messages: ["none", "view", "send"],
  invoices: ["none", "view", "edit"],
  finance: ["none", "view", "edit"],
  team: ["none", "view", "manage"],
  settings: ["none", "manage"],
} as const;

export type Capability = keyof typeof CAPABILITIES;
export type Level<C extends Capability> = (typeof CAPABILITIES)[C][number];
export type PermissionMap = { [C in Capability]: Level<C> };

export const ROLE_DEFAULTS: Record<WorkspaceRole, PermissionMap> = {
  OWNER: { projects: "manage", tasks: "edit", files: "upload", clients: "edit", messages: "send", invoices: "edit", finance: "edit", team: "manage", settings: "manage" },
  ADMIN: { projects: "manage", tasks: "edit", files: "upload", clients: "edit", messages: "send", invoices: "edit", finance: "edit", team: "manage", settings: "manage" },
  PROJECT_MANAGER: { projects: "manage", tasks: "edit", files: "upload", clients: "view", messages: "send", invoices: "view", finance: "none", team: "view", settings: "none" },
  COLLABORATOR: { projects: "view", tasks: "edit", files: "upload", clients: "none", messages: "view", invoices: "none", finance: "none", team: "none", settings: "none" },
  VIEWER: { projects: "view", tasks: "view", files: "view", clients: "none", messages: "view", invoices: "none", finance: "none", team: "none", settings: "none" },
};

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  COLLABORATOR: "Collaborator",
  VIEWER: "Viewer",
};

/** Validates arbitrary JSON into a partial permission map, dropping unknown keys/levels. */
export function sanitizePermissions(input: unknown): Partial<PermissionMap> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out as Partial<PermissionMap>;
  for (const [cap, levels] of Object.entries(CAPABILITIES)) {
    const v = (input as Record<string, unknown>)[cap];
    if (typeof v === "string" && (levels as readonly string[]).includes(v)) out[cap] = v;
  }
  return out as Partial<PermissionMap>;
}

export function resolvePermissions(role: WorkspaceRole, ...overrides: unknown[]): PermissionMap {
  const base = { ...ROLE_DEFAULTS[role] } as Record<string, string>;
  if (role === "OWNER") return base as PermissionMap; // owners cannot be restricted
  for (const o of overrides) Object.assign(base, sanitizePermissions(o));
  return base as PermissionMap;
}

export function hasLevel<C extends Capability>(perms: PermissionMap, cap: C, min: Level<C>) {
  const order = CAPABILITIES[cap] as readonly string[];
  return order.indexOf(perms[cap]) >= order.indexOf(min);
}
