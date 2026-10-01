import { env } from "@/lib/env";
import { makeT, plural, translate, type Locale } from "@/lib/i18n/core";

export function esc(s: string | null | undefined) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function nl2br(s: string) {
  return esc(s).replace(/\n/g, "<br/>");
}

type Brand = { name: string; logoUrl?: string | null };

/** Responsive, table-based layout that renders in all major clients. Light theme for readability. */
export function layout(opts: { l: Locale; brand: Brand; preheader?: string; title: string; bodyHtml: string; cta?: { label: string; url: string }; footerHtml?: string }) {
  const { brand } = opts;
  const logo = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" height="32" style="height:32px;max-width:180px;display:block"/>`
    : `<div style="font-size:16px;font-weight:600;color:#0b0d10">${esc(brand.name)}</div>`;
  const cta = opts.cta
    ? `<tr><td style="padding:8px 0 24px"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#4D7CFE;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">${esc(opts.cta.label)}</a></td></tr>`
    : "";
  return `<!doctype html><html lang="${opts.l}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(opts.title)}</title></head>
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
<tr><td style="padding:16px 32px 28px;border-top:1px solid #eef0f3;font-size:12px;line-height:1.5;color:#8d939e">${opts.footerHtml ?? esc(translate(opts.l, "Sent by {name} via FollowMyFuture.", { name: brand.name }))}</td></tr>
</table></td></tr></table></body></html>`;
}

const platformBrand: Brand = { name: "FollowMyFuture" };

export const emailTemplates = {
  emailVerification(link: string, l: Locale) {
    const t = makeT(l);
    return {
      subject: t("Verify your email address"),
      html: layout({ l, brand: platformBrand, title: t("Confirm your email"), bodyHtml: esc(t("Click the button below to verify your email address and finish setting up your workspace. This link expires in 24 hours.")), cta: { label: t("Verify email"), url: link } }),
    };
  },
  passwordReset(link: string, l: Locale) {
    const t = makeT(l);
    return {
      subject: t("Reset your password"),
      html: layout({ l, brand: platformBrand, title: t("Reset your password"), bodyHtml: esc(t("We received a request to reset your password. This link expires in 1 hour. If you didn't ask for this, you can ignore this email.")), cta: { label: t("Choose a new password"), url: link } }),
    };
  },
  collaboratorInvitation(o: { brand: Brand; inviter: string; role: string; link: string }, l: Locale) {
    const t = makeT(l);
    return {
      subject: t("{inviter} invited you to {workspace}", { inviter: o.inviter, workspace: o.brand.name }),
      html: layout({ l, brand: o.brand, title: t("Join {workspace}", { workspace: o.brand.name }), bodyHtml: t("{inviter} invited you to collaborate as <strong>{role}</strong>.", { inviter: esc(o.inviter), role: esc(t(o.role)) }), cta: { label: t("Accept invitation"), url: o.link } }),
    };
  },
  clientInvitation(o: { brand: Brand; clientName: string; projectName?: string; link: string; message?: string }, l: Locale) {
    const t = makeT(l);
    return {
      subject: t("Your project portal with {workspace}", { workspace: o.brand.name }),
      html: layout({
        l,
        brand: o.brand,
        title: o.projectName ? t("Follow {project}", { project: o.projectName }) : t("Your client portal"),
        bodyHtml: `${esc(t("Hi {name},", { name: o.clientName }))}<br/><br/>${o.message ? nl2br(o.message) + "<br/><br/>" : ""}${esc(t("{workspace} gave you access to a private portal where you can follow progress, review deliverables, access files and pay invoices — all in one place.", { workspace: o.brand.name }))}`,
        cta: { label: t("Open my portal"), url: o.link },
      }),
    };
  },
  notification(o: { brand: Brand; title: string; message: string; actionUrl?: string | null; actionLabel?: string | null }, l: Locale) {
    const t = makeT(l);
    return {
      subject: o.title,
      html: layout({ l, brand: o.brand, title: o.title, bodyHtml: nl2br(o.message), cta: o.actionUrl ? { label: o.actionLabel || t("Open"), url: absolute(o.actionUrl) } : undefined, footerHtml: `${esc(t("You receive this because of your notification preferences."))} <a href="${env.appUrl}/app/settings/notifications" style="color:#8d939e">${esc(t("Manage preferences"))}</a>.` }),
    };
  },
  invoiceSent(o: { brand: Brand; number: string; amount: string; dueDate: string; message?: string; link: string }, l: Locale) {
    const t = makeT(l);
    return {
      subject: t("Invoice {number} from {workspace}", { number: o.number, workspace: o.brand.name }),
      html: layout({
        l,
        brand: o.brand,
        preheader: t("{amount} due {date}", { amount: o.amount, date: o.dueDate }),
        title: t("Invoice {number}", { number: o.number }),
        bodyHtml: `${o.message ? nl2br(o.message) + "<br/><br/>" : ""}<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #eef0f3;border-radius:12px"><tr><td style="padding:14px 16px;color:#8d939e;font-size:13px">${esc(t("Amount due"))}</td><td align="right" style="padding:14px 16px;font-weight:600;font-size:18px;color:#0b0d10">${esc(o.amount)}</td></tr><tr><td style="padding:0 16px 14px;color:#8d939e;font-size:13px">${esc(t("Due date"))}</td><td align="right" style="padding:0 16px 14px;color:#0b0d10">${esc(o.dueDate)}</td></tr></table><br/>${esc(t("The invoice PDF is attached."))}`,
        cta: { label: t("View & pay invoice"), url: o.link },
      }),
    };
  },
  invoiceReminder(o: { brand: Brand; number: string; amount: string; dueDate: string; overdueDays: number; link: string }, l: Locale) {
    const t = makeT(l);
    const status =
      o.overdueDays > 0
        ? plural(l, o.overdueDays, "was due on {date} ({n} day ago)", "was due on {date} ({n} days ago)").replace("{date}", esc(o.dueDate))
        : t("is due on {date}", { date: esc(o.dueDate) });
    return {
      subject: t("Reminder: invoice {number} is awaiting payment", { number: o.number }),
      html: layout({ l, brand: o.brand, title: t("Invoice {number} is awaiting payment", { number: o.number }), bodyHtml: `${t("This is a friendly reminder that invoice <strong>{number}</strong> {status}.", { number: esc(o.number), status })}<br/><br/>${esc(t("Amount due"))}: <strong>${esc(o.amount)}</strong>`, cta: { label: t("View & pay invoice"), url: o.link } }),
    };
  },
  paymentConfirmation(o: { brand: Brand; number: string; amount: string; date: string; remaining?: string | null; link: string }, l: Locale) {
    const t = makeT(l);
    return {
      subject: t("Payment received — invoice {number}", { number: o.number }),
      html: layout({ l, brand: o.brand, title: t("Payment received"), bodyHtml: `${t("Thank you. We received your payment of <strong>{amount}</strong> for invoice {number} on {date}.", { amount: esc(o.amount), number: esc(o.number), date: esc(o.date) })}${o.remaining ? `<br/><br/>${esc(t("Remaining balance"))}: <strong>${esc(o.remaining)}</strong>` : ""}`, cta: { label: t("View invoice"), url: o.link } }),
    };
  },
  decisionReminder(o: { brand: Brand; clientName: string; items: { label: string; title: string; project: string | null; days: number }[]; link: string }, l: Locale) {
    const t = makeT(l);
    const rows = o.items
      .map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f3"><div style="font-size:12px;color:#8d939e;text-transform:uppercase;letter-spacing:.04em">${esc(i.label)}${i.project ? ` · ${esc(i.project)}` : ""}</div><div style="font-weight:600;color:#0b0d10">${esc(i.title)}</div><div style="font-size:12px;color:#8d939e">${esc(plural(l, i.days, "waiting for {n} day", "waiting for {n} days"))}</div></td></tr>`)
      .join("");
    return {
      subject: plural(l, o.items.length, "{n} item is waiting for your decision", "{n} items are waiting for your decision"),
      html: layout({
        l, brand: o.brand,
        title: t("Your input is needed"),
        bodyHtml: `${esc(t("Hello {name},", { name: o.clientName }))}<br/><br/>${esc(t("To keep your project moving, the following items are waiting for you:"))}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${rows}</table>`,
        cta: { label: t("Open my portal"), url: o.link },
      }),
    };
  },
  directMessage(o: { brand: Brand; subject: string; message: string; link?: string; linkLabel?: string }, l: Locale) {
    const t = makeT(l);
    return {
      subject: o.subject,
      html: layout({ l, brand: o.brand, title: o.subject, bodyHtml: nl2br(o.message), cta: o.link ? { label: o.linkLabel || t("Open portal"), url: o.link } : undefined }),
    };
  },
};

export function absolute(url: string) {
  return url.startsWith("http") ? url : `${env.appUrl}${url}`;
}
