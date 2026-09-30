import type { Tx } from "@/lib/db";

export function formatInvoiceNumber(prefix: string, includeYear: boolean, year: number, n: number, padding: number) {
  const num = String(n).padStart(padding, "0");
  return [prefix || null, includeYear ? String(year) : null, num].filter(Boolean).join("-");
}

/**
 * Allocates the next invoice number atomically. The UPSERT increments the counter in
 * a single statement (row-locked by Postgres), so concurrent sends can never collide;
 * the unique (workspaceId, number) constraint is a second line of defence.
 */
export async function allocateInvoiceNumber(tx: Tx, workspaceId: string, now = new Date()) {
  const settings = await tx.invoiceSettings.upsert({ where: { workspaceId }, create: { workspaceId }, update: {} });
  const year = now.getUTCFullYear();
  const scope = settings.includeYear ? String(year) : "ALL";
  const start = Math.max(1, settings.nextNumber);
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "InvoiceCounter" ("workspaceId", "scope", "last")
    VALUES (${workspaceId}::uuid, ${scope}, ${start})
    ON CONFLICT ("workspaceId", "scope")
    DO UPDATE SET "last" = GREATEST("InvoiceCounter"."last" + 1, ${start})
    RETURNING "last"`;
  const n = Number(rows[0].last);
  return formatInvoiceNumber(settings.prefix, settings.includeYear, year, n, settings.padding);
}
