import { vi } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/viewmywork_test";
process.env.DATABASE_URL = url;

process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.APP_URL = "http://localhost:3000";

// Request-scoped Next.js APIs are replaced by an in-memory fake so server actions run as-is.
export const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (cookieJar.has(k) ? { name: k, value: cookieJar.get(k)! } : undefined),
    set: (k: string, v: string) => void cookieJar.set(k, v),
    delete: (k: string) => void cookieJar.delete(k),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1", "user-agent": "vitest" }),
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => Promise<void>) => void fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${to}`), { digest: `NEXT_REDIRECT;${to}` });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  },
}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
