"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye } from "lucide-react";
import { Form, Submit, Textarea, Select } from "@/components/ui/form";
import { Avatar } from "@/components/ui/primitives";
import { postMessageAction } from "@/server/actions/messages";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { Tr, useI18n } from "@/lib/i18n/client";

export type MessageDTO = { id: string; body: string; authorName: string; fromClient: boolean; visibility: "INTERNAL" | "CLIENT_VISIBLE"; createdAt: Date | string; context?: string | null };

/**
 * Contextual conversation. The visibility of every message is explicit before sending:
 * internal notes and client-visible messages are styled and labelled differently.
 */
export function MessageThread({ messages, projectId, projectChoices, entityType = "PROJECT", entityId, canPost, allowClientVisible = true, action = postMessageAction, portal, poll = true }: { messages: MessageDTO[]; projectId?: string; projectChoices?: { id: string; name: string }[]; entityType?: string; entityId?: string; canPost: boolean; allowClientVisible?: boolean; action?: (fd: FormData) => Promise<ActionResult<unknown>>; portal?: boolean; poll?: boolean }) {
  const { t, fmt } = useI18n();
  const [visibility, setVisibility] = useState<"CLIENT_VISIBLE" | "INTERNAL">(allowClientVisible ? "CLIENT_VISIBLE" : "INTERNAL");
  const router = useRouter();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [messages.length]);
  useEffect(() => {
    if (!poll) return;
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [router, poll]);
  const internal = visibility === "INTERNAL";

  return (
    <div className="panel flex flex-col rounded-2xl">
      <ol className="max-h-[60vh] min-h-40 space-y-5 overflow-y-auto p-5" aria-label={t("Messages")}>
        {messages.length === 0 && <li className="py-10 text-center text-sm text-subtle"><Tr>No messages yet. Start the conversation.</Tr></li>}
        {messages.map((m) => (
          <li key={m.id} className={cn("flex gap-3", m.fromClient && !portal && "flex-row-reverse text-right", portal && !m.fromClient && "flex-row", portal && m.fromClient && "flex-row-reverse text-right")}>
            <Avatar name={m.authorName} size={28} />
            <div className={cn("max-w-[80%] min-w-0", (m.fromClient ? !portal : portal) && "items-end")}>
              <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] text-subtle" style={{ justifyContent: (m.fromClient && !portal) || (portal && m.fromClient) ? "flex-end" : "flex-start" }}>
                <span className="text-muted">{m.authorName}</span>
                {m.fromClient && !portal && <span className="text-accent"><Tr>Client</Tr></span>}
                {m.visibility === "INTERNAL" && <span className="flex items-center gap-1 text-warning"><Lock className="size-3" /><Tr>Internal</Tr></span>}
                {m.context && <span>· {m.context}</span>}
                <span>· {fmt.rel(m.createdAt)}</span>
              </div>
              <div className={cn("inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-left text-sm", m.visibility === "INTERNAL" ? "border border-dashed border-warning/30 bg-warning-soft/40" : m.fromClient ? "bg-accent-soft" : "bg-white/[0.05]")}>{m.body}</div>
            </div>
          </li>
        ))}
        <div ref={end} />
      </ol>
      {canPost && (
        <Form action={action} resetOnSuccess className={cn("border-t p-3 transition-colors", internal ? "border-warning/30 bg-warning-soft/20" : "border-line")}>
          {projectId && <input type="hidden" name="projectId" value={projectId} />}
          <input type="hidden" name="entityType" value={entityType} />
          {entityId && <input type="hidden" name="entityId" value={entityId} />}
          <input type="hidden" name="visibility" value={visibility} />
          {!projectId && projectChoices && (
            <Select name="projectId" aria-label={t("Project")} className="mb-2 h-8 text-xs">
              {projectChoices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          <Textarea name="body" rows={2} placeholder={internal ? t("Internal note — only your team will see this…") : portal ? t("Write a message…") : t("Message your client…")} aria-label={t("Message")} required />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {!portal && allowClientVisible ? (
              <div className="flex rounded-lg border border-line p-0.5 text-xs" role="radiogroup" aria-label={t("Message visibility")}>
                <button type="button" role="radio" aria-checked={!internal} onClick={() => setVisibility("CLIENT_VISIBLE")} className={cn("flex items-center gap-1 rounded-md px-2 py-1", !internal ? "bg-accent-soft text-[#9db9ff]" : "text-muted")}><Eye className="size-3" /><Tr>Visible to client</Tr></button>
                <button type="button" role="radio" aria-checked={internal} onClick={() => setVisibility("INTERNAL")} className={cn("flex items-center gap-1 rounded-md px-2 py-1", internal ? "bg-warning-soft text-warning" : "text-muted")}><Lock className="size-3" /><Tr>Internal note</Tr></button>
              </div>
            ) : <span className="text-xs text-subtle">{portal ? t("Your project team will be notified.") : t("Internal note")}</span>}
            <Submit size="sm">{portal ? t("Send") : internal ? t("Add internal note") : t("Send to client")}</Submit>
          </div>
        </Form>
      )}
    </div>
  );
}
