import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { preview } from "vite";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(repo, "apps", "web");
const chrome = [
  process.env.DAYFLOW_BROWSER_BIN,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((candidate) => candidate && existsSync(candidate));
if (!chrome) throw new Error("Chrome or Edge unavailable for isolated PWA smoke test");

const origin = "http://127.0.0.1:4193";
let server;
let browser;
try {
  server = await preview({
    root: webDir,
    configFile: path.join(webDir, "vite.config.ts"),
    logLevel: "error",
    preview: { host: "127.0.0.1", port: 4193, strictPort: true },
  });
  browser = await chromium.launch({ executablePath: chrome, headless: true });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url()));

  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    null,
    { timeout: 15000 },
  );
  const assets = await page.evaluate(async () => {
    const urls = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
    }
    return urls.sort();
  });
  if (!assets.some((url) => url === "/index.html")) {
    throw new Error("Static service worker did not cache the offline shell");
  }
  if (!assets.some((url) => url.startsWith("/assets/"))) {
    throw new Error("Static service worker did not precache Vite JS/CSS assets");
  }
  if (
    assets.some(
      (url) =>
        url.startsWith("/api/") ||
        (!["/", "/index.html", "/manifest.webmanifest", "/dayflow-icon.svg"].includes(url) &&
          !url.startsWith("/assets/")),
    )
  ) {
    throw new Error("Service worker cached an unapproved resource");
  }
  console.log("G7_PWA_STATIC_ONLY_CACHE_POLICY=PASS");

  await context.setOffline(true);
  await page.goto(origin + "/?offline-check=1", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor({ timeout: 10000 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor({ timeout: 10000 });
  await page.getByText(/Chưa kết nối được máy chủ/).waitFor({ timeout: 10000 });
  if (errors.length > 0) throw new Error("Offline shell JS errors: " + errors.join(" | "));
  if (failedRequests.some((url) => url.includes("/assets/"))) {
    throw new Error("Hashed static bundle failed during offline PWA navigation");
  }
  await mkdir(path.join(repo, ".artifacts"), { recursive: true });
  await page.screenshot({
    path: path.join(repo, ".artifacts", "g7-pwa-offline-shell.png"),
    fullPage: true,
  });
  console.log("G7_PWA_OFFLINE_RELOAD_SHELL=PASS");
  console.log("G7_PWA_NO_PRIVATE_RESPONSE_CACHE=PASS");
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) {
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
}
