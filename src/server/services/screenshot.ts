import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { assertPublicUrl } from "@/lib/safe-fetch";

export type ShotDevice = "desktop" | "mobile";

const DEVICES: Record<ShotDevice, { width: number; height: number; maxHeight: number; mobile: boolean; ua?: string }> = {
  desktop: { width: 1280, height: 800, maxHeight: 4000, mobile: false },
  mobile: {
    width: 390, height: 844, maxHeight: 5000, mobile: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
};

const FRESH_MS = 6 * 3600_000;

async function launch() {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  // Local development: any Chrome/Chromium binary.
  const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
}

/** Every request the page makes must go to a public host (no SSRF through the headless browser). */
function hostGuard() {
  const cache = new Map<string, Promise<boolean>>();
  const allowPrivate = process.env.SITE_SHOT_ALLOW_PRIVATE === "1" && !process.env.VERCEL;
  return (url: string) => {
    let u: URL;
    try { u = new URL(url); } catch { return Promise.resolve(false); }
    if (u.protocol === "data:" || u.protocol === "blob:") return Promise.resolve(true);
    if (!["http:", "https:"].includes(u.protocol)) return Promise.resolve(false);
    if (allowPrivate) return Promise.resolve(true);
    const key = `${u.protocol}//${u.host}`;
    if (!cache.has(key)) cache.set(key, assertPublicUrl(key).then(() => true, () => false));
    return cache.get(key)!;
  };
}

/** Full-page screenshot (capped height) as JPEG, taken by our own headless browser. */
export async function captureSite(url: string, device: ShotDevice): Promise<Uint8Array<ArrayBuffer>> {
  await assertPublicUrl(url).catch((e) => { if (!(process.env.SITE_SHOT_ALLOW_PRIVATE === "1" && !process.env.VERCEL)) throw e; });
  const d = DEVICES[device];
  const browser = await launch();
  try {
    const page = await browser.newPage();
    if (d.ua) await page.setUserAgent(d.ua);
    await page.setViewport({ width: d.width, height: d.height, isMobile: d.mobile, hasTouch: d.mobile, deviceScaleFactor: 1 });
    const allowed = hostGuard();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      allowed(req.url()).then((ok) => (ok ? req.continue() : req.abort("blockedbyclient"))).catch(() => req.abort().catch(() => {}));
    });
    // Sites with a loading screen or lazy content: wait for the network to settle, then a little more.
    await page.goto(url, { waitUntil: "networkidle2", timeout: 25_000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    // Trigger lazy-loaded images by scrolling through the page once.
    await page.evaluate(async (max) => {
      const step = window.innerHeight;
      for (let y = 0; y < Math.min(document.documentElement.scrollHeight, max); y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
    }, d.maxHeight).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));
    const full = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => d.height);
    const height = Math.max(d.height, Math.min(full, d.maxHeight));
    const img = await page.screenshot({ type: "jpeg", quality: 70, clip: { x: 0, y: 0, width: d.width, height }, captureBeyondViewport: true });
    return new Uint8Array(img);
  } finally {
    await browser.close().catch(() => {});
  }
}

const keyOf = (url: string, device: ShotDevice) => createHash("sha256").update(`${device}|${url}`).digest("hex");

/** Cached screenshot; re-taken when older than a few hours or when `fresh` is asked. */
export async function getSiteShot(url: string, device: ShotDevice, fresh = false) {
  const key = keyOf(url, device);
  const cached = await db.siteShot.findUnique({ where: { key } });
  if (cached && !fresh && Date.now() - cached.createdAt.getTime() < FRESH_MS) return cached.data;
  try {
    const data = await captureSite(url, device);
    await db.siteShot.upsert({ where: { key }, create: { key, url, device, data }, update: { data, createdAt: new Date() } });
    return data;
  } catch (e) {
    if (cached) return cached.data; // keep showing the last good capture
    throw e;
  }
}
