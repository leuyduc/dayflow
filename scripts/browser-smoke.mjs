import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";

const executablePath = [
  process.env.DAYFLOW_BROWSER_BIN,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((candidate) => candidate && existsSync(candidate));
if (!executablePath) {
  console.error("BLOCKED: Chrome/Chromium not found. Set DAYFLOW_BROWSER_BIN.");
  process.exitCode = 2;
} else {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    await mkdir(".artifacts", { recursive: true });
    const errors = [];
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    desktop.on("pageerror", (error) => errors.push(error.message));
    await desktop.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
    await desktop.getByRole("heading", { name: "Hôm nay", exact: true }).waitFor();
    await desktop.getByRole("status").getByText("API đã kết nối").waitFor();
    await desktop
      .getByRole("navigation", { name: "Các màn hình" })
      .getByRole("button", { name: "Công việc" })
      .click();
    await desktop.getByRole("heading", { name: "Công việc", exact: true }).waitFor();
    await desktop.screenshot({ path: ".artifacts/g2-desktop.png", fullPage: true });
    console.log("DESKTOP_NAV_AND_API_STATUS=PASS");

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.on("pageerror", (error) => errors.push(error.message));
    await mobile.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
    await mobile
      .getByRole("navigation", { name: "Điều hướng điện thoại" })
      .getByRole("button", { name: "Lịch" })
      .click();
    await mobile.getByRole("heading", { name: "Lịch", exact: true }).waitFor();
    const overflows = await mobile.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflows) throw new Error("Mobile horizontal overflow");
    await mobile.screenshot({ path: ".artifacts/g2-mobile.png", fullPage: true });
    console.log("MOBILE_NAV_AND_NO_OVERFLOW=PASS");
    if (errors.length > 0) throw new Error(errors.join(" | "));
    console.log("BROWSER_RUNTIME_ERRORS=NONE");
  } finally {
    await browser.close();
  }
}
