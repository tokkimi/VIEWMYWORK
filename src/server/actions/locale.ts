"use server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/core";
import { setLocaleCookie } from "@/lib/i18n/server";

/** Switches the interface language; also saved on the account so emails follow it. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return { ok: false as const };
  await setLocaleCookie(locale);
  const user = await getSessionUser();
  if (user && user.locale !== locale) await db.user.update({ where: { id: user.id }, data: { locale } });
  return { ok: true as const };
}
