import { ZodError } from "zod";
import { getLocale } from "@/lib/i18n/server";
import { renderMsg, translateMessage, type Msg } from "@/lib/i18n/core";

export class AppError extends Error {
  /** English source message (with optional {vars}), translated when returned to the user. */
  msg: Msg;
  constructor(message: Msg, public code: "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "LIMIT" | "CONFIG" | "RATE_LIMIT" | "CONFLICT" = "INVALID") {
    super(renderMsg("en", message));
    this.msg = message;
  }
}
export const forbidden = (msg: Msg = "You don't have permission to do this.") => new AppError(msg, "FORBIDDEN");
export const notFound = (msg: Msg = "Not found.") => new AppError(msg, "NOT_FOUND");

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

/** Wraps a server action body: maps known errors to a serialisable result, never leaks internals. Messages are translated to the request locale. */
export async function runAction<T>(fn: () => Promise<T>, message?: Msg): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    const locale = await getLocale();
    return { ok: true, data, message: message === undefined ? undefined : renderMsg(locale, message) };
  } catch (err) {
    // Re-throw Next.js control-flow errors (redirect/notFound).
    if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) throw err;
    const locale = await getLocale();
    if (err instanceof AppError) return { ok: false, error: typeof err.msg === "string" ? translateMessage(locale, err.msg) : renderMsg(locale, err.msg), code: err.code };
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const k = issue.path.join(".");
        if (!fieldErrors[k]) fieldErrors[k] = translateMessage(locale, issue.message);
      }
      return { ok: false, error: translateMessage(locale, err.issues[0]?.message ?? "Invalid input."), code: "INVALID", fieldErrors };
    }
    console.error("[action]", err);
    return { ok: false, error: translateMessage(locale, "Something went wrong. Please try again.") };
  }
}
