import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace, getProjectAccess } from "@/lib/auth/context";
import { AppError } from "@/lib/errors";

/** Loads a project for professional pages (tenant + membership checked). 404s instead of leaking existence. */
export const loadProject = cache(async (id: string) => {
  const ctx = await requireWorkspace();
  try {
    const { project, perms } = await getProjectAccess(ctx, id);
    const full = await db.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { client: true, manager: { select: { id: true, name: true } }, phases: { orderBy: { position: "asc" } } },
    });
    return { ctx, project: full, perms };
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
});
