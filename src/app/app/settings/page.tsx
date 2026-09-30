import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace, can } from "@/lib/auth/context";
import { GeneralForm } from "@/components/app/settings-forms";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Settings");

export default async function GeneralSettings() {
  const ctx = await requireWorkspace();
  if (!can(ctx, "settings", "manage")) redirect("/app/settings/notifications");
  const s = await db.workspaceSetting.findUnique({ where: { workspaceId: ctx.workspace.id } });
  return <GeneralForm ws={ctx.workspace} company={s ?? {}} />;
}
