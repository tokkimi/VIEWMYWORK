import { z } from "zod";
import { parseMoneyToCents } from "@/lib/money";

export const zId = z.string().uuid("Invalid identifier.");
export const zOptId = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().uuid().optional());
export const zStr = (max = 200) => z.string().trim().max(max);
export const zReq = (label: string, max = 200) => z.string().trim().min(1, `${label} is required.`).max(max);
export const zOptStr = (max = 2000) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
export const zEmail = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
export const zOptEmail = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), zEmail.optional());
export const zOptDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.date().optional());
export const zDate = z.coerce.date({ message: "Enter a valid date." });
export const zMoney = z.preprocess((v) => parseMoneyToCents(v as string), z.number({ message: "Enter a valid amount." }).int());
export const zOptMoney = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : parseMoneyToCents(v as string)), z.number({ message: "Enter a valid amount." }).int().nonnegative().optional());
export const zBool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
export const zCurrency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Invalid currency.");
export const zUrl = z.string().trim().url("Enter a valid URL.").refine((u) => /^https?:\/\//i.test(u), "Only http(s) links are allowed.").max(2000);
export const zPercentBps = z.preprocess((v) => (v === "" || v === undefined ? 0 : Math.round(Number(String(v).replace(",", ".")) * 100)), z.number().int().min(0).max(10000));

export function formToObject(fd: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      o[key] = [...((o[key] as unknown[]) ?? []), v];
    } else o[k] = v;
  }
  return o;
}
