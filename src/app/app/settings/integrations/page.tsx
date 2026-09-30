import { db } from "@/lib/db";
import { requireWorkspace, requirePerm } from "@/lib/auth/context";
import { integrations } from "@/lib/env";
import { hasFeature } from "@/lib/plans";
import { DrivePanel } from "@/components/app/settings-forms";
import { Section } from "@/components/ui/primitives";

export const metadata = { title: "Integrations" };

const ERR: Record<string, string> = { not_configured: "Google Drive isn't configured on this platform.", plan: "Upgrade your plan to use Google Drive.", state: "The connection expired. Please try again.", denied: "Access was not granted.", exchange: "Google rejected the connection.", forbidden: "You can't manage integrations." };

export default async function Integrations({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "settings", "manage");
  const sp = await searchParams;
  const drive = await db.integration.findUnique({ where: { workspaceId_provider: { workspaceId: ctx.workspace.id, provider: "GOOGLE_DRIVE" } } });
  const cfg = (drive?.config ?? {}) as { defaultFolderName?: string };
  return (
    <div className="space-y-8">
      {sp.connected && <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">Google Drive connected.</p>}
      {sp.error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{ERR[sp.error] ?? "Something went wrong."}</p>}
      <Section title="Google Drive">
        <div className="panel rounded-2xl p-5">
          <DrivePanel state={drive ? { status: drive.status, accountEmail: drive.accountEmail, lastError: drive.lastError, folderName: cfg.defaultFolderName } : null} configured={integrations.googleDrive()} allowed={await hasFeature(ctx.workspace.id, "google_drive")} />
        </div>
      </Section>
      <p className="text-xs text-subtle">Slack, Google Calendar, accounting software and a public API are on the roadmap.</p>
    </div>
  );
}
