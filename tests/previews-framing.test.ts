import { describe, it, expect, vi, beforeEach } from "vitest";

// A plain function (not vi.fn): vitest reports errors thrown by spies as test failures.
type Res = { status: number; finalUrl: string; headers: Headers; body: string };
let impl: () => Promise<Res> = async () => { throw new Error("not set"); };
vi.mock("@/lib/safe-fetch", () => ({ safeFetch: () => impl() }));
const fetchMock = { mockResolvedValue: (r: Res) => { impl = async () => r; }, fail: () => { impl = async () => { throw new TypeError("fetch failed"); }; }, mockReset: () => {} };

const { inspectUrl } = await import("@/server/services/previews");

const res = (status: number, headers: Record<string, string> = {}, finalUrl = "https://site.example/") => ({ status, finalUrl, headers: new Headers(headers), body: "<title>Site</title>" });

describe("inspectUrl framing verdict", () => {
  beforeEach(() => fetchMock.mockReset());

  it("allows a site without framing headers", async () => {
    fetchMock.mockResolvedValue(res(200));
    expect((await inspectUrl("https://site.example/")).embeddable).toBe(true);
  });

  it("marks X-Frame-Options DENY / SAMEORIGIN as refused", async () => {
    fetchMock.mockResolvedValue(res(200, { "x-frame-options": "SAMEORIGIN" }));
    expect((await inspectUrl("https://site.example/")).embeddable).toBe(false);
  });

  it("marks a restrictive CSP frame-ancestors as refused", async () => {
    fetchMock.mockResolvedValue(res(200, { "content-security-policy": "frame-ancestors 'self'" }));
    expect((await inspectUrl("https://site.example/")).embeddable).toBe(false);
  });

  it("treats a login wall / bot checkpoint (error status) as unknown, even with DENY", async () => {
    fetchMock.mockResolvedValue(res(401, { "x-frame-options": "DENY" }));
    expect((await inspectUrl("https://app.vercel.app/")).embeddable).toBeNull();
  });

  it("treats a redirect to another host (e.g. Vercel login) as unknown", async () => {
    fetchMock.mockResolvedValue(res(200, { "x-frame-options": "DENY" }, "https://vercel.com/login?next=x"));
    expect((await inspectUrl("https://app.vercel.app/")).embeddable).toBeNull();
  });

  it("treats an unreachable site as unknown", async () => {
    fetchMock.fail();
    expect((await inspectUrl("https://site.example/")).embeddable).toBeNull();
  });
});
