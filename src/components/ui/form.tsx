"use client";

import { useEffect, createContext, useContext, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { useToast } from "./toast";
import { buttonClass } from "./button";
import { Tx, useI18n } from "@/lib/i18n/client";

const FormCtx = createContext<{ errors: Record<string, string>; pending: boolean }>({ errors: {}, pending: false });

type Props = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (fd: FormData) => Promise<ActionResult<unknown>>;
  onSuccess?: (data: unknown) => void;
  successMessage?: string;
  redirectTo?: string | ((data: unknown) => string | undefined);
  resetOnSuccess?: boolean;
  refresh?: boolean;
};

/**
 * Progressive client form bound to a server action. Server returns a typed ActionResult;
 * field errors render inline and a toast confirms outcome — success is only shown when the
 * server actually succeeded.
 */
export function Form({ action, onSuccess, successMessage, redirectTo, resetOnSuccess, refresh = true, className, children, ...rest }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <FormCtx.Provider value={{ errors, pending }}>
      <form
        ref={ref}
        className={className}
        noValidate
        // POST, never GET: if someone submits before the page is interactive, fields (passwords!)
        // must not end up in the URL. The submit button is also disabled until hydration.
        method="post"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return; // no double submit
          // Include the clicked submit button's name/value (forms with several submit buttons).
          const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          start(async () => {
            const res = await action(fd);
            if (!res.ok) {
              setErrors(res.fieldErrors ?? {});
              toast.error(res.error);
              return;
            }
            setErrors({});
            if (successMessage || res.message) toast.success(res.message ?? t(successMessage!));
            if (resetOnSuccess) ref.current?.reset();
            onSuccess?.(res.data);
            const to = typeof redirectTo === "function" ? redirectTo(res.data) : redirectTo;
            if (to) router.push(to);
            else if (refresh) router.refresh();
          });
        }}
        {...rest}
      >
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
      </form>
    </FormCtx.Provider>
  );
}

export function useFormState() {
  return useContext(FormCtx);
}

export function Submit({ children, variant = "primary", size = "md", className, pendingLabel }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "outline" | "ghost"; size?: "sm" | "md" | "lg"; className?: string; pendingLabel?: string }) {
  const { pending } = useFormState();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <button type="submit" aria-busy={pending} disabled={!ready || pending} className={buttonClass(variant, size, className)}>
      {pending && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
      {pending && pendingLabel ? t(pendingLabel) : <Tx>{children}</Tx>}
    </button>
  );
}

export function FieldError({ name }: { name: string }) {
  const { errors } = useFormState();
  if (!errors[name]) return null;
  return (
    <p id={`${name}-error`} role="alert" className="mt-1.5 text-xs text-danger">
      {errors[name]}
    </p>
  );
}

export function Field({ label, name, hint, children, className, optional }: { label: string; name: string; hint?: string; children: ReactNode; className?: string; optional?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={name} className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-fg/90">
        <span>{t(label)}</span>
        {optional && <span className="text-[11px] font-normal text-subtle">{t("Optional")}</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{t(hint)}</p>}
      <FieldError name={name} />
    </div>
  );
}

export const inputClass =
  "w-full rounded-[10px] border border-line bg-white/[0.03] px-3 h-9 text-sm text-fg placeholder:text-subtle transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60 aria-[invalid=true]:border-danger";

export function Input({ className, name, ...props }: ComponentProps<"input">) {
  const { errors } = useFormState();
  const err = name ? errors[name] : undefined;
  return <input id={name} name={name} aria-invalid={err ? true : undefined} aria-describedby={err ? `${name}-error` : undefined} className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, name, rows = 4, ...props }: ComponentProps<"textarea">) {
  const { errors } = useFormState();
  const err = name ? errors[name] : undefined;
  return <textarea id={name} name={name} rows={rows} aria-invalid={err ? true : undefined} className={cn(inputClass, "h-auto py-2 leading-relaxed resize-y", className)} {...props} />;
}

export function Select({ className, name, children, ...props }: ComponentProps<"select">) {
  const { errors } = useFormState();
  const err = name ? errors[name] : undefined;
  return (
    <select id={name} name={name} aria-invalid={err ? true : undefined} className={cn(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238d939e%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, name, defaultChecked, description, value }: { label: string; name: string; defaultChecked?: boolean; description?: string; value?: string }) {
  const { t } = useI18n();
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="mt-0.5 size-4 shrink-0 rounded border-line-strong bg-transparent accent-[#4d7cfe]" />
      <span>
        <span className="text-fg">{t(label)}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{t(description)}</span>}
      </span>
    </label>
  );
}
