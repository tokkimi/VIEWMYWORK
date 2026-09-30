import { env } from "@/lib/env";

export function esc(s: string | null | undefined) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function nl2br(s: string) {
  return esc(s).replace(/\n/g, "<br/>");
}

type Brand = { name: string; logoUrl?: string | null };

/** Responsive, table-based layout that renders in all major clients. Light theme for readability. */
export function layout(opts: { brand: Brand; preheader?: string; title: string; bodyHtml: string; cta?: { label: string; url: string }; footerHtml?: string }) {
  const { brand } = opts;
  const logo = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" height="32" style="height:32px;max-width:180px;display:block"/>`
    : `<div style="font-size:16px;font-weight:600;color:#0b0d10">${esc(brand.name)}</div>`;
  const cta = opts.cta
    ? `<tr><td style="padding:8px 0 24px"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#4D7CFE;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">${esc(opts.cta.label)}</a></td></tr>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#0b0d10">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader ?? opts.title)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e8ec;border-radius:16px">
<tr><td style="padding:28px 32px 8px">${logo}</td></tr>
<tr><td style="padding:8px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:22px;line-height:1.3;font-weight:600;padding:12px 0 12px">${esc(opts.title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#3b4150;padding-bottom:20px">${opts.bodyHtml}</td></tr>
${cta}
</table></td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #eef0f3;font-size:12px;line-height:1.5;color:#8d939e">${opts.footerHtml ?? `Sent by ${esc(brand.name)} via ViewMyWork.`}</td></tr>
</table></td></tr></table></body></html>`;
}

const platformBrand: Brand = { name: "ViewMyWork" };

export const emailTemplates = {
  emailVerification(link: string) {
    return {
      subject: "Verify your email address",
      html: layout({ brand: platformBrand, title: "Confirm your email", bodyHtml: "Click the button below to verify your email address and finish setting up your workspace. This link expires in 24 hours.", cta: { label: "Verify email", url: link } }),
    };
  },
  passwordReset(link: string) {
    return {
      subject: "Reset your password",
      html: layout({ brand: platformBrand, title: "Reset your password", bodyHtml: "We received a request to reset your password. This link expires in 1 hour. If you didn't ask for this, you can ignore this email.", cta: { label: "Choose a new password", url: link } }),
    };
  },
  collaboratorInvitation(o: { brand: Brand; inviter: string; role: string; link: string }) {
    return {
      subject: `${o.inviter} invited you to ${o.brand.name}`,
      html: layout({ brand: o.brand, title: `Join ${o.brand.name}`, bodyHtml: `${esc(o.inviter)} invited you to collaborate as <strong>${esc(o.role)}</strong>.`, cta: { label: "Accept invitation", url: o.link } }),
    };
  },
  clientInvitation(o: { brand: Brand; clientName: string; projectName?: string; link: string; message?: string }) {
    return {
      subject: `Your project portal with ${o.brand.name}`,
      html: layout({
        brand: o.brand,
        title: o.projectName ? `Follow ${o.projectName}` : "Your client portal",
        bodyHtml: `Hi ${esc(o.clientName)},<br/><br/>${o.message ? nl2br(o.message) + "<br/><br/>" : ""}${esc(o.brand.name)} gave you access to a private portal where you can follow progress, review deliverables, access files and pay invoices — all in one place.`,
        cta: { label: "Open my portal", url: o.link },
      }),
    };
  },
  notification(o: { brand: Brand; title: string; message: string; actionUrl?: string | null; actionLabel?: string | null }) {
    return {
      subject: o.title,
      html: layout({ brand: o.brand, title: o.title, bodyHtml: nl2br(o.message), cta: o.actionUrl ? { label: o.actionLabel || "Open", url: absolute(o.actionUrl) } : undefined, footerHtml: `You receive this because of your notification preferences. <a href="${env.appUrl}/app/settings/notifications" style="color:#8d939e">Manage preferences</a>.` }),
    };
  },
  invoiceSent(o: { brand: Brand; number: string; amount: string; dueDate: string; message?: string; link: string }) {
    return {
      subject: `Invoice ${o.number} from ${o.brand.name}`,
      html: layout({
        brand: o.brand,
        preheader: `${o.amount} due ${o.dueDate}`,
        title: `Invoice ${o.number}`,
        bodyHtml: `${o.message ? nl2br(o.message) + "<br/><br/>" : ""}<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #eef0f3;border-radius:12px"><tr><td style="padding:14px 16px;color:#8d939e;font-size:13px">Amount due</td><td align="right" style="padding:14px 16px;font-weight:600;font-size:18px;color:#0b0d10">${esc(o.amount)}</td></tr><tr><td style="padding:0 16px 14px;color:#8d939e;font-size:13px">Due date</td><td align="right" style="padding:0 16px 14px;color:#0b0d10">${esc(o.dueDate)}</td></tr></table><br/>The invoice PDF is attached.`,
        cta: { label: "View & pay invoice", url: o.link },
      }),
    };
  },
  invoiceReminder(o: { brand: Brand; number: string; amount: string; dueDate: string; overdueDays: number; link: string }) {
    const status = o.overdueDays > 0 ? `was due on ${esc(o.dueDate)} (${o.overdueDays} day${o.overdueDays > 1 ? "s" : ""} ago)` : `is due on ${esc(o.dueDate)}`;
    return {
      subject: `Reminder: invoice ${o.number} is awaiting payment`,
      html: layout({ brand: o.brand, title: `Invoice ${o.number} is awaiting payment`, bodyHtml: `This is a friendly reminder that invoice <strong>${esc(o.number)}</strong> ${status}.<br/><br/>Amount due: <strong>${esc(o.amount)}</strong>`, cta: { label: "View & pay invoice", url: o.link } }),
    };
  },
  paymentConfirmation(o: { brand: Brand; number: string; amount: string; date: string; remaining?: string | null; link: string }) {
    return {
      subject: `Payment received — invoice ${o.number}`,
      html: layout({ brand: o.brand, title: "Payment received", bodyHtml: `Thank you. We received your payment of <strong>${esc(o.amount)}</strong> for invoice ${esc(o.number)} on ${esc(o.date)}.${o.remaining ? `<br/><br/>Remaining balance: <strong>${esc(o.remaining)}</strong>` : ""}`, cta: { label: "View invoice", url: o.link } }),
    };
  },
  directMessage(o: { brand: Brand; subject: string; message: string; link?: string; linkLabel?: string }) {
    return {
      subject: o.subject,
      html: layout({ brand: o.brand, title: o.subject, bodyHtml: nl2br(o.message), cta: o.link ? { label: o.linkLabel || "Open portal", url: o.link } : undefined }),
    };
  },
};

export function absolute(url: string) {
  return url.startsWith("http") ? url : `${env.appUrl}${url}`;
}
