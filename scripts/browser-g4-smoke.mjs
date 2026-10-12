import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const executablePath = [
  process.env.DAYFLOW_BROWSER_BIN,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
].find((p) => p && existsSync(p));
if (!executablePath) throw new Error("Chrome executable not found");

const browser = await chromium.launch({ executablePath, headless: true });
let tasks = [];
let loggedIn = false;
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let status = 200;
    let data = {};
    const headers = { "content-type": "application/json" };
    if (path === "/api/health") data = { status: "ok" };
    else if (path === "/api/auth/me") {
      if (loggedIn)
        data = {
          user: { id: "local-owner", email: "test@example.test" },
          csrfToken: "only-test-csrf",
        };
      else {
        status = 401;
        data = { error: "unauthorized" };
      }
    } else if (path === "/api/auth/login" && method === "POST") {
      loggedIn = true;
      data = {
        user: { id: "local-owner", email: "test@example.test" },
        csrfToken: "only-test-csrf",
      };
      headers["set-cookie"] = "dayflow_session=only-test-cookie; HttpOnly; SameSite=Strict; Path=/";
    } else if (path === "/api/auth/logout" && method === "POST") {
      loggedIn = false;
      data = { ok: true };
    } else if (path.startsWith("/api/tasks")) {
      if (!loggedIn) {
        status = 401;
        data = { error: "unauthorized" };
      } else if (method === "GET") data = { tasks };
      else {
        if (request.headers()["x-dayflow-csrf"] !== "only-test-csrf") {
          status = 403;
          data = { error: "csrf" };
        } else {
          const body = request.postDataJSON();
          if (method === "POST") {
            const now = new Date().toISOString();
            const task = {
              id: "11111111-1111-4111-8111-111111111111",
              title: body.title,
              description: null,
              status: "inbox",
              priority: "medium",
              dueDate: null,
              estimatedMinutes: null,
              tags: [],
              revision: 1,
              completedAt: null,
              createdAt: now,
              updatedAt: now,
            };
            tasks = [task];
            status = 201;
            data = { task };
          } else if (method === "PATCH") {
            const { expectedRevision: _revision, ...patch } = body;
            void _revision;
            const task = {
              ...tasks[0],
              ...patch,
              revision: tasks[0].revision + 1,
              completedAt:
                patch.status === "completed"
                  ? new Date().toISOString()
                  : patch.status === "inbox"
                    ? null
                    : tasks[0].completedAt,
            };
            tasks = [task];
            data = { task };
          } else if (method === "DELETE") {
            tasks = [];
            data = { deleted: true };
          }
        }
      }
    }
    await route.fulfill({ status, headers, body: JSON.stringify(data) });
  });

  await page.goto("http://127.0.0.1:5173", { waitUntil: "networkidle" });
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor();
  await page.getByLabel("Email").fill("test@example.test");
  await page.getByLabel("Mật khẩu").fill("Test-Password-Only");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByLabel("Ghi nhanh công việc").waitFor();
  await page
    .getByRole("navigation", { name: "Các màn hình" })
    .getByRole("button", { name: "Công việc" })
    .click();
  await page.getByLabel("Ghi nhanh công việc").fill("Bài test Chrome G4");
  await page.getByRole("button", { name: "Thêm việc" }).click();
  await page.getByText("Bài test Chrome G4").waitFor();
  await page.getByRole("button", { name: "Sửa" }).click();
  await page.getByLabel("Tiêu đề").fill("Đã sửa trên Chrome");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page.getByText("Đã sửa trên Chrome").waitFor();
  await page.getByRole("button", { name: "Hoàn thành Đã sửa trên Chrome" }).click();
  await page.getByRole("button", { name: "Mở lại Đã sửa trên Chrome" }).waitFor();
  await page.getByRole("button", { name: "Mở lại Đã sửa trên Chrome" }).click();
  await page.getByRole("button", { name: "Hoàn thành Đã sửa trên Chrome" }).waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Xóa" }).click();
  await page.getByText("Chưa có công việc phù hợp").waitFor();
  console.log("G4_CHROME_LOGIN_CREATE_EDIT_COMPLETE_REOPEN_DELETE=PASS");
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
    throw new Error("Horizontal overflow at mobile size");
  console.log("G4_CHROME_MOBILE_NO_OVERFLOW=PASS");
  if (errors.length) throw new Error("Browser runtime errors: " + errors.join(" | "));
  console.log("G4_CHROME_RUNTIME_ERRORS=NONE");
} finally {
  await browser.close();
}
