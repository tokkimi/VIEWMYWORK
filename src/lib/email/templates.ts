import { env } from "@/lib/env";
import { makeT, makeFmt, plural, translate, type Locale } from "@/lib/i18n/core";
import type { ReportData } from "@/lib/reports";
import { DECISION_LABEL } from "@/lib/decisions";

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
  projectReport(o: { brand: Brand; clientName: string; data: ReportData; note?: string | null; link: string }, l: Locale) {
    const t = makeT(l);
    const f = makeFmt(l);
    const d = o.data;
    const h = (s: string) => `<div style="margin:22px 0 6px;font-size:12px;font-weight:600;color:#8d939e;text-transform:uppercase;letter-spacing:.05em">${esc(s)}</div>`;
    const li = (items: string[]) => `<ul style="margin:0;padding-left:18px">${items.map((x) => `<li style="margin:3px 0">${x}</li>`).join("")}</ul>`;
    const delta = d.previousProgress === null ? "" : d.project.progress - d.previousProgress;
    const bar = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px"><tr><td style="background:#eef0f3;border-radius:6px;height:8px"><div style="width:${Math.max(2, Math.min(100, d.project.progress))}%;background:#4D7CFE;border-radius:6px;height:8px"></div></td></tr></table>`;
    let body = `${esc(t("Hello {name},", { name: o.clientName }))}<br/>${esc(t("Here is where your project stands this week."))}`;
    body += `<div style="margin-top:18px;padding:16px;border:1px solid #eef0f3;border-radius:12px"><div style="font-size:13px;color:#8d939e">${esc(d.project.name)}</div><div style="font-size:28px;font-weight:700;color:#0b0d10">${d.project.progress}%${typeof delta === "number" && delta > 0 ? ` <span style="font-size:14px;font-weight:600;color:#16a34a">+${delta} ${esc(t("pts this week"))}</span>` : ""}</div>${bar}${d.project.targetDate ? `<div style="margin-top:8px;font-size:13px;color:#8d939e">${esc(t("Planned delivery: {date}", { date: f.date(d.project.targetDate) }))}</div>` : ""}</div>`;
    if (o.note) body += h(t("A word from the team")) + `<div>${nl2br(o.note)}</div>`;
    if (d.done.length) body += h(t("Done this week")) + li(d.done.map((x) => `✓ ${esc(x.title)}${x.kind === "deliverable" ? ` <span style="color:#8d939e">(${esc(t("approved"))})</span>` : ""}`)) + (d.doneTotal > d.done.length ? `<div style="font-size:13px;color:#8d939e">${esc(t("and {n} more", { n: d.doneTotal - d.done.length }))}</div>` : "");
    if (d.inProgress.length) body += h(t("In progress")) + li(d.inProgress.map(esc));
    if (d.next.length) body += h(t("Next steps")) + li(d.next.map((x) => `${esc(x.title)}${x.date ? ` <span style="color:#8d939e">· ${esc(f.short(x.date))}</span>` : ""}`));
    if (d.update) body += h(d.update.title || t("Latest update")) + `<div>${nl2br(d.update.body)}</div>`;
    if (d.waiting.length) {
      body += h(t("Waiting for you"));
      body += li(d.waiting.map((w) => `<b>${esc(w.kind === "PAYMENT" ? t("Invoice {number}", { number: w.title }) : w.title)}</b> <span style="color:#8d939e">· ${esc(t(DECISION_LABEL[w.kind]))} · ${esc(w.days === 0 ? t("Since today") : plural(l, w.days, "waiting for {n} day", "waiting for {n} days"))}</span>`));
      if (d.waiting.some((w) => w.days >= 7)) body += `<div style="margin-top:8px;padding:10px 12px;background:#fff7ed;border-radius:10px;color:#9a3412;font-size:13px">${esc(t("Some items have been waiting for over a week and may delay the project."))}</div>`;
    }
    return {
      subject: t("Weekly report · {project}", { project: d.project.name }),
      html: layout({ l, brand: o.brand, title: t("Your weekly report"), preheader: t("{progress}% complete · {project}", { progress: d.project.progress, project: d.project.name }), bodyHtml: body, cta: { label: t("Open the report"), url: o.link } }),
    };
  },
  teamDigest(o: { brand: Brand; name: string; stats: { live: number; onTrack: number; atRisk: number; offTrack: number; overdue: number; waiting: number; oldestWait: number }; risky: { name: string; status: string; score: number; alert: string | null; url: string }[]; deadlines: { label: string; project: string; date: string }[]; link: string }, l: Locale) {
    const t = makeT(l);
    const f = makeFmt(l);
    const s = o.stats;
    const cell = (label: string, v: string | number, color = "#0b0d10") => `<td style="padding:10px;border:1px solid #eef0f3;border-radius:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:${color}">${esc(String(v))}</div><div style="font-size:11px;color:#8d939e">${esc(label)}</div></td>`;
    let body = `${esc(t("Hello {name},", { name: o.name }))}<br/>${esc(t("Your portfolio this week, in one minute."))}`;
    body += `<table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin-top:14px"><tr>${cell(t("Active projects"), s.live)}${cell(t("At risk"), s.atRisk, s.atRisk ? "#d97706" : "#0b0d10")}${cell(t("Off track"), s.offTrack, s.offTrack ? "#dc2626" : "#0b0d10")}</tr><tr>${cell(t("Overdue tasks"), s.overdue, s.overdue ? "#d97706" : "#0b0d10")}${cell(t("Waiting for client"), s.waiting)}${cell(t("Longest wait (days)"), s.oldestWait)}</tr></table>`;
    if (o.risky.length) {
      body += `<div style="margin:22px 0 6px;font-size:12px;font-weight:600;color:#8d939e;text-transform:uppercase;letter-spacing:.05em">${esc(t("Projects to watch"))}</div>`;
      body += o.risky.map((r) => `<div style="padding:10px 0;border-bottom:1px solid #eef0f3"><a href="${esc(r.url)}" style="color:#0b0d10;font-weight:600;text-decoration:none">${esc(r.name)}</a> <span style="font-size:12px;color:${r.status === "off_track" ? "#dc2626" : "#d97706"}">${esc(t(r.status === "off_track" ? "Off track" : "At risk"))} · ${r.score}</span>${r.alert ? `<div style="font-size:13px;color:#3b4150">${esc(r.alert)}</div>` : ""}</div>`).join("");
    } else body += `<div style="margin-top:18px;color:#16a34a">${esc(t("All projects are on track."))}</div>`;
    if (o.deadlines.length) {
      body += `<div style="margin:22px 0 6px;font-size:12px;font-weight:600;color:#8d939e;text-transform:uppercase;letter-spacing:.05em">${esc(t("Deadlines in the next 7 days"))}</div>`;
      body += `<ul style="margin:0;padding-left:18px">${o.deadlines.map((x) => `<li style="margin:3px 0">${esc(f.short(x.date))} · <b>${esc(x.project)}</b> — ${esc(x.label)}</li>`).join("")}</ul>`;
    }
    return { subject: t("Weekly digest · {n} active projects", { n: s.live }), html: layout({ l, brand: o.brand, title: t("Your weekly digest"), bodyHtml: body, cta: { label: t("Open project health"), url: o.link } }) };
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
