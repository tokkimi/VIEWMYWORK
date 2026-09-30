import { db } from "@/lib/db";
import { env, integrations } from "@/lib/env";

export type EmailAttachment = { filename: string; content: Buffer };

export type SendEmailInput = {
  to: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  template: string;
  workspaceId?: string | null;
  entityType?: string;
  entityId?: string;
  attachments?: EmailAttachment[];
  fromName?: string;
};

export type EmailStatus = "SENT" | "FAILED" | "NOT_CONFIGURED";

/**
 * Sends a transactional email through Resend and records every attempt in EmailLog.
 * When no provider is configured the attempt is logged as NOT_CONFIGURED and the
 * caller surfaces that state — we never pretend an email was delivered.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ status: EmailStatus; error?: string }> {
  let status: EmailStatus = "NOT_CONFIGURED";
  let providerMessageId: string | null = null;
  let failureReason: string | null = null;

  if (integrations.email()) {
    try {
      const from = input.fromName ? `${input.fromName.replace(/[<>"]/g, "")} <${env.email.from.match(/<(.+)>/)?.[1] ?? env.email.from}>` : env.email.from;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.email.resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [input.to],
          cc: input.cc?.length ? input.cc : undefined,
          bcc: input.bcc?.length ? input.bcc : undefined,
          reply_to: input.replyTo,
          subject: input.subject,
          html: input.html,
          text: input.text,
          attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) {
        status = "SENT";
        providerMessageId = body.id ?? null;
      } else {
        status = "FAILED";
        failureReason = body.message ?? `HTTP ${res.status}`;
      }
    } catch (e) {
      status = "FAILED";
      failureReason = e instanceof Error ? e.message : "Network error";
    }
  } else if (!env.isProd) {
    console.info(`[email:dev] ${input.template} → ${input.to}: ${input.subject}`);
  }

  await db.emailLog.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      recipient: input.to,
      cc: [...(input.cc ?? []), ...(input.bcc ?? [])],
      template: input.template,
      subject: input.subject,
      entityType: input.entityType,
      entityId: input.entityId,
      providerMessageId,
      status,
      failureReason,
      sentAt: status === "SENT" ? new Date() : null,
    },
  });
  return { status, error: failureReason ?? undefined };
}
