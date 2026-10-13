/**
 * G7 production PWA static-shell smoke. Only tests locally built public files.
 * Verifies offline reload works without caching any authenticated /api response.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { preview } from "vite";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(repo, "apps", "web");
const origin = "http://127.0.0.1:5178";
const browserPath = [
  process.env.DAYFLOW_BROWSER_BIN,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
].find((file) => file && existsSync(file));
if (!browserPath) throw new Error("Chrome/Edge required");
if (!existsSync(path.join(webDir, "dist", "index.html")))
  throw new Error("Build web first: npm run build");

let server;
let browser;
try {
  server = await preview({
    root: webDir,
    configFile: path.join(webDir, "vite.config.ts"),
    preview: { host: "127.0.0.1", port: 5178, strictPort: true },
    logLevel: "error",
  });
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push({ url: request.url(), reason: request.failure()?.errorText }),
  );
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor();
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 15_000 });
  const cacheInspection = await page.evaluate(async () => {
    const keys = await caches.keys();
    const assetUrls = [];
    for (const key of keys) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) assetUrls.push(new URL(request.url).pathname);
    }
    return { keys, assetUrls };
  });
  if (!cacheInspection.keys.some((key) => key.startsWith("dayflow-shell-")))
    throw new Error("PWA shell was not installed");
  if (
    !cacheInspection.assetUrls.includes("/index.html") ||
    !cacheInspection.assetUrls.some((url) => url.startsWith("/assets/"))
  )
    throw new Error("PWA shell or JS/CSS bundle missing from offline cache");
  if (cacheInspection.assetUrls.some((url) => url.startsWith("/api/")))
    throw new Error("Private API endpoint leaked into the service worker cache");
  console.log("G7_PWA_STATIC_SHELL_CACHED_NO_PRIVATE_API=PASS");

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(1000);
  const offlineState = await page.evaluate(async () => ({
    body: document.body.innerText.slice(0, 500),
    controller: navigator.serviceWorker?.controller?.scriptURL,
    scripts: Array.from(document.scripts).map((item) => item.src),
  }));
  console.log(
    "G7_PWA_OFFLINE_DIAGNOSTIC",
    JSON.stringify({
      ...offlineState,
      errors,
      failedRequests,
    }),
  );
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor({ timeout: 5000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (overflow) throw new Error("Offline PWA shell overflows mobile viewport");
  if (errors.length !== 0) throw new Error(errors.join(" | "));
  console.log("G7_PWA_OFFLINE_RELOAD_LOGIN_GATED=PASS");
  console.log("G7_PWA_STATIC_ONLY_RESULT=PASS");
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
}
