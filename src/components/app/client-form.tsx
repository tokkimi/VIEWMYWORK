"use client";

import { Form, Submit, Field, Input, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ClientFields, type ClientValues } from "./entity-fields";
import { createClientAction, updateClientAction, inviteClientToPortalAction, createPortalLinkAction, sendClientEmailAction, addClientContactAction } from "@/server/actions/clients";
import { useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Mail, UserPlus, Send, Pencil, Plus, Link2, Share2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { cn } from "@/lib/cn";
import { Tr, useI18n } from "@/lib/i18n/client";

export function ClientForm({ v, onDone }: { v: ClientValues; onDone?: () => void }) {
  const { t } = useI18n();
  return (
    <Form action={v.id ? updateClientAction : createClientAction} redirectTo={v.id ? undefined : (d) => `/app/clients/${(d as { id: string }).id}`} onSuccess={onDone} className="space-y-6">
      <ClientFields v={v} />
      <div className="flex justify-end border-t border-line pt-5"><Submit>{v.id ? t("Save changes") : t("Create client")}</Submit></div>
    </Form>
  );
}

export function EditClientDialog({ v }: { v: ClientValues }) {
  return (
    <Dialog title="Edit client" size="lg" trigger={(open) => <Button onClick={open}><Pencil className="size-4" /><Tr>Edit</Tr></Button>}>
      {(close) => <ClientForm v={v} onDone={close} />}
    </Dialog>
  );
}

/** wa.me needs the number in international format, digits only. */
function waNumber(phone: string) {
  const p = phone.trim().replace(/^00/, "+");
  const digits = p.replace(/\D/g, "");
  // A French local number (06…) without country code: assume +33.
  if (!p.startsWith("+") && /^0[1-9]\d{8}$/.test(digits)) return `33${digits.slice(1)}`;
  return digits;
}

type Channel = "email" | "whatsapp" | "link";

/** Share portal access by email, WhatsApp or a plain link (for clients without an email address). */
export function InviteToPortalDialog({ clientId, email, phone, projectId, label = "Invite to portal" }: { clientId: string; email: string; phone?: string | null; projectId?: string; label?: string }) {
  const { t } = useI18n();
  const [channel, setChannel] = useState<Channel>(email ? "email" : phone ? "whatsapp" : "link");
  const [res, setRes] = useState<{ link: string; emailStatus?: string } | null>(null);
  const [tel, setTel] = useState(phone ?? "");
  const [shared, setShared] = useState(false);
  const message = (link: string) => t("Hello! Here is your private access to follow your project: {link}", { link });
  const waHref = (link: string) => `https://wa.me/${waNumber(tel)}?text=${encodeURIComponent(message(link))}`;
  const reset = () => { setRes(null); setShared(false); };
  const tabs: { k: Channel; label: string; icon: React.ReactNode }[] = [
    { k: "email", label: "Email", icon: <Mail className="size-4" /> },
    { k: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon className="size-4 text-[#25D366]" /> },
    { k: "link", label: "Access link", icon: <Link2 className="size-4" /> },
  ];
  return (
    <Dialog title="Share the client portal" description="Your client gets a private portal to follow progress, approve work and pay invoices." trigger={(open) => <Button onClick={() => { reset(); open(); }}><UserPlus className="size-4" />{t(label)}</Button>}>
      {(close) => (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line p-1" role="tablist">
            {tabs.map((x) => (
              <button key={x.k} type="button" role="tab" aria-selected={channel === x.k} onClick={() => { setChannel(x.k); reset(); }} className={cn("flex flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[12px] sm:flex-row sm:gap-1.5 sm:text-[13px]", channel === x.k ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg")}>
                {x.icon}<span className="whitespace-nowrap">{t(x.label)}</span>
              </button>
            ))}
          </div>

          {channel === "email" && (res ? (
            <div className="space-y-4 text-sm">
              {res.emailStatus === "SENT" ? <p><Tr>Invitation sent. The link is valid for 14 days.</Tr></p> : <p className="rounded-lg bg-warning-soft p-3 text-warning"><Tr>The invitation was created but</Tr> <strong><Tr>no email was sent</Tr></strong>. <Tr>Share this link with your client directly:</Tr></p>}
              <div className="flex items-center gap-2 rounded-lg border border-line p-2"><code className="min-w-0 flex-1 truncate text-xs">{res.link}</code><CopyButton value={res.link} label="Copy" /></div>
              <div className="flex justify-end"><Button onClick={close}><Tr>Done</Tr></Button></div>
            </div>
          ) : (
            <Form action={inviteClientToPortalAction} onSuccess={(d) => setRes(d as { link: string; emailStatus: string })} className="space-y-4">
              <input type="hidden" name="clientId" value={clientId} />
              {projectId && <input type="hidden" name="projectId" value={projectId} />}
              <Field label="Email" name="email"><Input name="email" type="email" defaultValue={email} required /></Field>
              <Field label="Personal message" name="message" optional><Textarea name="message" rows={3} /></Field>
              <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Send invitation</Tr></Submit></div>
            </Form>
          ))}

          {channel === "whatsapp" && (res ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted"><Tr>Your access link is ready. Open WhatsApp to send it — the message is pre-filled.</Tr></p>
              <a href={waHref(res.link)} target="_blank" rel="noreferrer noopener" onClick={() => setShared(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#25D366] font-medium text-[#062b14] hover:bg-[#20bd5a]">
                <WhatsAppIcon className="size-5" />{t("Send on WhatsApp")}
              </a>
              <div className="flex items-center gap-2 rounded-lg border border-line p-2"><code className="min-w-0 flex-1 truncate text-xs">{res.link}</code><CopyButton value={res.link} label="Copy" /></div>
              <p className="text-xs text-subtle"><Tr>Single use, valid for 14 days. Your client creates their account from the link with the email of their choice.</Tr></p>
              <div className="flex justify-end"><Button onClick={close}>{shared ? t("Done") : t("Close")}</Button></div>
            </div>
          ) : (
            <Form action={createPortalLinkAction} onSuccess={(d) => setRes(d as { link: string })} className="space-y-4">
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="channel" value="whatsapp" />
              {projectId && <input type="hidden" name="projectId" value={projectId} />}
              <Field label="WhatsApp number" name="tel" optional hint="With country code, e.g. +33 6 12 34 56 78. Leave empty to choose the contact in WhatsApp."><Input name="tel" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+33 6 12 34 56 78" /></Field>
              <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><WhatsAppIcon className="size-4" /><Tr>Create the WhatsApp link</Tr></Submit></div>
            </Form>
          ))}

          {channel === "link" && (res ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted"><Tr>Send this link to your client by SMS, Messenger or any app.</Tr></p>
              <div className="flex items-center gap-2 rounded-lg border border-line p-2"><code className="min-w-0 flex-1 truncate text-xs">{res.link}</code><CopyButton value={res.link} label="Copy" /></div>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button className="w-full" onClick={() => navigator.share({ text: message(res.link) }).catch(() => {})}><Share2 className="size-4" />{t("Share…")}</Button>
              )}
              <p className="text-xs text-subtle"><Tr>Single use, valid for 14 days. Your client creates their account from the link with the email of their choice.</Tr></p>
              <div className="flex justify-end"><Button onClick={close}><Tr>Done</Tr></Button></div>
            </div>
          ) : (
            <Form action={createPortalLinkAction} onSuccess={(d) => setRes(d as { link: string })} className="space-y-4">
              <input type="hidden" name="clientId" value={clientId} />
              {projectId && <input type="hidden" name="projectId" value={projectId} />}
              <p className="text-sm text-muted"><Tr>Create a private access link you can send however you like — no email address needed.</Tr></p>
              <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Link2 className="size-4" /><Tr>Create access link</Tr></Submit></div>
            </Form>
          ))}
        </div>
      )}
    </Dialog>
  );
}

export function SendEmailDialog({ clientId, to, userEmail }: { clientId: string; to: string; userEmail: string }) {
  const { t } = useI18n();
  return (
    <Dialog title="Send email" description={t("To {to}. Replies go to {email}.", { to, email: userEmail })} trigger={(open) => <Button onClick={open}><Mail className="size-4" /><Tr>Send email</Tr></Button>}>
      {(close) => (
        <Form action={sendClientEmailAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Subject" name="subject"><Input name="subject" required /></Field>
          <Field label="Message" name="message"><Textarea name="message" rows={7} required /></Field>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="sendCopy" className="accent-[#4d7cfe]" /><Tr>Send me a copy</Tr></label>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Send className="size-4" /><Tr>Send</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function AddContactDialog({ clientId }: { clientId: string }) {
  const { t } = useI18n();
  return (
    <Dialog title="Add contact" trigger={(open) => <Button size="sm" variant="ghost" onClick={open}><Plus className="size-3.5" /><Tr>Add contact</Tr></Button>}>
      {(close) => (
        <Form action={addClientContactAction} onSuccess={close} resetOnSuccess className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Name" name="name"><Input name="name" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" optional><Input name="email" type="email" /></Field>
            <Field label="Phone" name="phone" optional><Input name="phone" /></Field>
          </div>
          <Field label="Role" name="role" optional><Input name="role" placeholder={t("Marketing lead")} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Add</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}
