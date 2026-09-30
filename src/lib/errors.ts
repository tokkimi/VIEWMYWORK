import { ZodError } from "zod";

export class AppError extends Error {
  constructor(message: string, public code: "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "LIMIT" | "CONFIG" | "RATE_LIMIT" | "CONFLICT" = "INVALID") {
    super(message);
  }
}
export const forbidden = (msg = "You don't have permission to do this.") => new AppError(msg, "FORBIDDEN");
export const notFound = (msg = "Not found.") => new AppError(msg, "NOT_FOUND");

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

/** Wraps a server action body: maps known errors to a serialisable result, never leaks internals. */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (err) {
    // Re-throw Next.js control-flow errors (redirect/notFound).
    if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) throw err;
    if (err instanceof AppError) return { ok: false, error: err.message, code: err.code };
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const k = issue.path.join(".");
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { ok: false, error: err.issues[0]?.message ?? "Invalid input.", code: "INVALID", fieldErrors };
    }
    console.error("[action]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
