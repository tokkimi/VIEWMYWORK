"use server";

import { db } from "@/lib/db";
import { runAction, AppError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth/session";
import { TOPIC_LABELS, type Topic } from "@/lib/events";

export async function savePreferencesAction(fd: FormData) {
  return runAction(async () => {
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in again.", "FORBIDDEN");
    const topics = Object.keys(TOPIC_LABELS) as Topic[];
    await db.$transaction(
      topics.map((topic) => {
        const inApp = fd.get(`${topic}_inApp`) === "on";
        const email = fd.get(`${topic}_email`) === "on";
        return db.notificationPreference.upsert({ where: { userId_topic: { userId: user.id, topic } }, create: { userId: user.id, topic, inApp, email }, update: { inApp, email } });
      }),
    );
    return null;
  }, "Preferences saved.");
}
