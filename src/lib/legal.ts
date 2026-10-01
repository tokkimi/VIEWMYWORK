/**
 * Publisher of FollowMyFuture, shown in the legal pages. Override in the environment
 * (LEGAL_COMPANY_NAME, LEGAL_ADDRESS, LEGAL_IDE, LEGAL_EMAIL) — no code change needed.
 */
export const LEGAL = {
  company: process.env.LEGAL_COMPANY_NAME?.trim() || "X",
  address: process.env.LEGAL_ADDRESS?.trim() || null, // full postal address in Switzerland
  ide: process.env.LEGAL_IDE?.trim() || null, // Swiss company number (CHE-xxx.xxx.xxx)
  email: process.env.LEGAL_EMAIL?.trim() || "contact@followmyfuture.com",
  updated: new Date("2026-10-01T00:00:00Z"),
};

export type LegalSection = [title: string, body: string | string[]];
