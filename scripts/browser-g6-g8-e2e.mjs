import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "pg";
import { Algorithm, hash } from "@node-rs/argon2";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(repo, "apps", "web");
const ownerPass = randomBytes(24).toString("hex");
const csrfSecret = randomBytes(40).toString("hex");
const connectionString = process.env.DATABASE_URL;
const appOrigin = "http://127.0.0.1:5175";
const knownChrome = [
  process.env.DAYFLOW_BROWSER_BIN,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((entry) => entry && existsSync(entry));

function assert(value, message) {
  if (!value) throw new Error(message);
}
if (!connectionString) throw new Error("DATABASE_URL missing");
{
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname).slice(1);
  assert(
    process.env.DAYFLOW_DB_ENV === "development" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      /^dayflow_test_/.test(name) &&
      url.username === "dayflow_dev",
    "Requires an isolated localhost dayflow_test_ database",
  );
}
if (!knownChrome) throw new Error("Chrome executable not found");

let sql;
let closeStore;
let api;
let vite;
let browser;
try {
  const migrate = spawnSync(
    process.execPath,
    [path.join(repo, "apps", "api", "dist", "db", "migrate-development.js")],
    {
      cwd: repo,
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, DATABASE_URL: connectionString, DAYFLOW_DB_ENV: "development" },
    },
  );
  assert(migrate.status === 0, "Isolated development migration failed");
  sql = new Client({ connectionString, connectionTimeoutMillis: 4000 });
  await sql.connect();

  const ownerEmail = "g6g8-browser@example.test";
  const passwordHash = await hash(ownerPass, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const owner = await sql.query(
    "INSERT INTO users (email,password_hash) VALUES ($1,$2) RETURNING id",
    [ownerEmail, passwordHash],
  );
  const ownerId = owner.rows[0].id;
  // Two unscheduled open tasks, seeded directly so the browser flow starts from real data.
  await sql.query(
    "INSERT INTO tasks (id,user_id,title,priority,estimated_minutes) VALUES ($1,$2,'E2E plan report','high',60),($3,$2,'E2E call client','medium',30)",
    [randomUUID(), ownerId, randomUUID()],
  );

  const { createPostgresStore } = await import(
    pathToFileURL(path.join(repo, "apps", "api", "dist", "db", "postgres-store.js")).href
  );
  const { buildApp } = await import(
    pathToFileURL(path.join(repo, "apps", "api", "dist", "app.js")).href
  );
  const instance = createPostgresStore(connectionString);
  closeStore = instance.close;
  api = buildApp({
    auth: {
      store: instance.store,
      tasks: instance.store,
      sync: instance.store,
      backup: instance.store,
      settings: instance.store,
      csrfSecret,
      allowedOrigin: appOrigin,
      cookieSecure: false,
    },
  });
  const apiAddress = await api.listen({ host: "127.0.0.1", port: 0 });
  vite = await createServer({
    root: webDir,
    configFile: path.join(webDir, "vite.config.ts"),
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port: 5175,
      strictPort: true,
      proxy: { "/api": { target: apiAddress, changeOrigin: true } },
    },
  });
  await vite.listen();

  browser = await chromium.launch({ executablePath: knownChrome, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(appOrigin, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor();
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Mật khẩu").fill(ownerPass);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("navigation", { name: "Các màn hình" }).waitFor();

  // Calendar: suggest, preview, accept.
  await page
    .getByRole("navigation", { name: "Các màn hình" })
    .getByRole("button", { name: "Lịch" })
    .click();
  await page.getByRole("button", { name: "Gợi ý lịch 7 ngày" }).click();
  const preview = page.getByRole("list", { name: "Gợi ý lịch" });
  await preview.getByText("E2E plan report").waitFor();
  await preview.getByText("E2E call client").waitFor();
  await page.getByRole("button", { name: "Chấp nhận 2 khối" }).click();
  await page.getByText("Đã lưu 2 khối lịch.").waitFor();
  let rows = await sql.query(
    "SELECT title,status,scheduled_start,scheduled_end FROM tasks WHERE user_id=$1 AND deleted_at IS NULL ORDER BY scheduled_start",
    [ownerId],
  );
  assert(
    rows.rowCount === 2 && rows.rows.every((r) => r.status === "scheduled"),
    "Schedule not persisted",
  );
  const [a, b] = rows.rows;
  assert(
    a.scheduled_end > a.scheduled_start && a.scheduled_end <= b.scheduled_start,
    "Scheduled blocks overlap or are invalid",
  );
  console.log("G6_E2E_ACCEPT_SCHEDULE_POSTGRES=PASS");

  // Unschedule one block from the calendar.
  await page.getByRole("button", { name: "Bỏ lịch" }).first().click();
  await page.getByText("Chưa xếp lịch (1)").waitFor();
  rows = await sql.query(
    "SELECT count(*)::int AS n FROM tasks WHERE user_id=$1 AND status='scheduled' AND deleted_at IS NULL",
    [ownerId],
  );
  assert(rows.rows[0].n === 1, "Unschedule not persisted");
  console.log("G6_E2E_UNSCHEDULE_POSTGRES=PASS");

  // Calendar navigation and manual placement, including persistence in PostgreSQL.
  await page.getByRole("button", { name: "Tháng", exact: true }).click();
  await page.locator(".month-grid .month-cell").first().waitFor();
  await page.getByRole("button", { name: "Ngày", exact: true }).click();
  await page.getByRole("form", { name: "Thêm việc vào ngày đang xem" }).waitFor();
  await page.getByRole("button", { name: "Tuần", exact: true }).click();
  const unplaced = await sql.query(
    "SELECT id,title FROM tasks WHERE user_id=$1 AND status='inbox' AND deleted_at IS NULL",
    [ownerId],
  );
  assert(unplaced.rowCount === 1, "Expected one task available for manual placement");
  const unplacedTask = unplaced.rows[0];
  await page.getByLabel("Giờ bắt đầu " + unplacedTask.title).fill("2032-06-03T10:00");
  await page.getByRole("button", { name: "Xếp giờ" }).click();
  await page.getByText("Đã xếp " + unplacedTask.title + ".").waitFor();
  rows = await sql.query(
    "SELECT status,scheduled_start,scheduled_end FROM tasks WHERE id=$1 AND user_id=$2",
    [unplacedTask.id, ownerId],
  );
  assert(
    rows.rowCount === 1 &&
      rows.rows[0].status === "scheduled" &&
      rows.rows[0].scheduled_start instanceof Date &&
      rows.rows[0].scheduled_end > rows.rows[0].scheduled_start,
    "Manual calendar placement not persisted",
  );
  console.log("G6_E2E_NAVIGATION_AND_MANUAL_PLACE_POSTGRES=PASS");

  // Backup export downloads a versioned file with the owner's tasks.
  await page
    .getByRole("navigation", { name: "Các màn hình" })
    .getByRole("button", { name: "Cài đặt" })
    .click();
  // Persist non-default owner settings before exporting. A backup must not use browser defaults.
  await page.getByLabel("Múi giờ").fill("Asia/Tokyo");
  await page.getByLabel("Giờ bắt đầu").fill("08:15");
  await page.getByLabel("Giờ kết thúc").fill("16:45");
  await page.getByLabel("Thời lượng mặc định (phút)").fill("45");
  await page.getByLabel("Nghỉ giữa các khối (phút)").fill("5");
  await page.getByLabel("Tuần bắt đầu vào").selectOption("0");
  await page.getByLabel("Giao diện").selectOption("dark");
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await page.getByText("Đã lưu cài đặt.").waitFor();
  let savedSettings = await sql.query(
    "SELECT time_zone,working_day_start,working_day_end,default_task_duration_minutes,buffer_minutes,week_starts_on,theme FROM settings WHERE user_id=$1",
    [ownerId],
  );
  assert(
    savedSettings.rowCount === 1 &&
      savedSettings.rows[0].time_zone === "Asia/Tokyo" &&
      savedSettings.rows[0].working_day_start === "08:15" &&
      savedSettings.rows[0].working_day_end === "16:45" &&
      savedSettings.rows[0].default_task_duration_minutes === 45 &&
      savedSettings.rows[0].buffer_minutes === 5 &&
      savedSettings.rows[0].week_starts_on === 0 &&
      savedSettings.rows[0].theme === "dark",
    "Custom owner settings were not persisted",
  );
  console.log("G8_E2E_SETTINGS_SAVE_POSTGRES=PASS");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Xuất sao lưu JSON" }).click(),
  ]);
  const exportPath = await download.path();
  const exported = JSON.parse(await readFile(exportPath, "utf8"));
  assert(exported.format === "dayflow-backup" && exported.version === 1, "Bad export envelope");
  assert(exported.tasks.length === 2, "Export count mismatch: " + exported.tasks.length);
  assert(
    exported.settings.timeZone === "Asia/Tokyo" &&
      exported.settings.workingDayStart === "08:15" &&
      exported.settings.defaultTaskDurationMinutes === 45 &&
      exported.settings.weekStartsOn === 0 &&
      exported.settings.theme === "dark",
    "Exported backup does not contain the owner's persisted settings",
  );
  console.log("G8_E2E_EXPORT_DOWNLOAD_AND_SAVED_SETTINGS=PASS");

  // Import: one existing id (skipped) plus one new task.
  const newId = randomUUID();
  exported.tasks.push({
    ...exported.tasks[0],
    id: newId,
    title: "E2E imported task",
    status: "inbox",
    scheduledStart: null,
    scheduledEnd: null,
    completedAt: null,
  });
  const importPath = path.join(repo, ".artifacts", "e2e-import.json");
  await mkdir(path.dirname(importPath), { recursive: true });
  await writeFile(importPath, JSON.stringify(exported));
  await page.locator("#backup-file").setInputFiles(importPath);
  await page.getByText("Tệp có 3 công việc: 1 mới, 2 đã tồn tại").waitFor();
  await page.getByRole("button", { name: "Nhập 1 công việc" }).click();
  await page.getByText(/Đã nhập 1 công việc\. Bỏ qua 2 công việc đã tồn tại/).waitFor();
  rows = await sql.query("SELECT id FROM tasks WHERE user_id=$1 AND deleted_at IS NULL", [ownerId]);
  assert(rows.rowCount === 3 && rows.rows.some((r) => r.id === newId), "Import not persisted");
  console.log("G8_E2E_IMPORT_MERGE_POSTGRES=PASS");

  // Restore settings even when all task IDs already exist; verify both database and live UI.
  const settingsOnlyPath = path.join(repo, ".artifacts", "e2e-settings-only.json");
  const settingsOnly = {
    ...exported,
    settings: {
      ...exported.settings,
      timeZone: "Asia/Singapore",
      workingDayStart: "09:10",
      weekStartsOn: 1,
      theme: "light",
    },
  };
  await writeFile(settingsOnlyPath, JSON.stringify(settingsOnly));
  await page.locator("#backup-file").setInputFiles(settingsOnlyPath);
  await page.getByText("Tệp có 3 công việc: 0 mới, 3 đã tồn tại").waitFor();
  await page.getByRole("button", { name: "Chỉ khôi phục cài đặt lịch" }).click();
  await page.getByText(/Đã nhập 0 công việc\. Bỏ qua 3 công việc đã tồn tại/).waitFor();
  await page.waitForFunction(
    () => document.querySelector("#settings-zone")?.value === "Asia/Singapore",
  );
  assert(
    (await page.getByLabel("Giao diện").inputValue()) === "light" &&
      (await page.getByLabel("Tuần bắt đầu vào").inputValue()) === "1",
    "Settings UI did not refresh after settings-only restore",
  );
  savedSettings = await sql.query(
    "SELECT time_zone,working_day_start,week_starts_on,theme FROM settings WHERE user_id=$1",
    [ownerId],
  );
  assert(
    savedSettings.rows[0].time_zone === "Asia/Singapore" &&
      savedSettings.rows[0].working_day_start === "09:10" &&
      savedSettings.rows[0].week_starts_on === 1 &&
      savedSettings.rows[0].theme === "light",
    "Settings-only restore did not persist",
  );
  console.log("G8_E2E_SETTINGS_ONLY_RESTORE_AND_REFRESH=PASS");

  // A scheduled block conflicting with an existing block rejects the whole import,
  // including the settings change that would otherwise occur in the same transaction.
  const existingBlock = await sql.query(
    "SELECT scheduled_start,scheduled_end FROM tasks WHERE user_id=$1 AND scheduled_start IS NOT NULL AND deleted_at IS NULL ORDER BY scheduled_start LIMIT 1",
    [ownerId],
  );
  assert(existingBlock.rowCount === 1, "Cannot build overlapping import fixture");
  const overlapId = randomUUID();
  const overlapping = {
    ...settingsOnly,
    settings: { ...settingsOnly.settings, theme: "dark" },
    tasks: [
      ...settingsOnly.tasks,
      {
        ...settingsOnly.tasks[0],
        id: overlapId,
        title: "E2E overlapping import",
        status: "scheduled",
        scheduledStart: existingBlock.rows[0].scheduled_start.toISOString(),
        scheduledEnd: existingBlock.rows[0].scheduled_end.toISOString(),
        completedAt: null,
      },
    ],
  };
  const overlapPath = path.join(repo, ".artifacts", "e2e-overlap.json");
  await writeFile(overlapPath, JSON.stringify(overlapping));
  await page.locator("#backup-file").setInputFiles(overlapPath);
  await page.getByText("Tệp có 4 công việc: 1 mới, 3 đã tồn tại").waitFor();
  await page.getByRole("button", { name: "Nhập 1 công việc" }).click();
  await page
    .getByRole("alert")
    .getByText(/trùng với lịch đang có/)
    .waitFor();
  const overlapCheck = await sql.query(
    "SELECT (SELECT count(*)::int FROM tasks WHERE user_id=$1 AND deleted_at IS NULL) AS task_count, (SELECT theme FROM settings WHERE user_id=$1) AS theme",
    [ownerId],
  );
  assert(
    overlapCheck.rows[0].task_count === 3 && overlapCheck.rows[0].theme === "light",
    "Rejected overlapping import altered tasks or settings",
  );
  console.log("G8_E2E_OVERLAP_TRANSACTION_ROLLBACK=PASS");

  // Invalid file is rejected before any write.
  const badPath = path.join(repo, ".artifacts", "e2e-bad.json");
  await writeFile(badPath, JSON.stringify({ format: "other" }));
  await page.locator("#backup-file").setInputFiles(badPath);
  await page
    .getByRole("alert")
    .getByText(/không phải DayFlow/)
    .waitFor();
  rows = await sql.query(
    "SELECT count(*)::int AS n FROM tasks WHERE user_id=$1 AND deleted_at IS NULL",
    [ownerId],
  );
  assert(rows.rows[0].n === 3, "Invalid import changed data");
  console.log("G8_E2E_INVALID_IMPORT_REJECTED=PASS");

  // Responsive mobile navigation and month grid with the same authenticated owner.
  const mobile = await context.newPage();
  mobile.on("pageerror", (error) => pageErrors.push(error.message));
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(appOrigin, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await mobile
    .getByRole("navigation", { name: "Điều hướng điện thoại" })
    .getByRole("button", { name: "Lịch" })
    .click();
  await mobile.getByRole("heading", { name: "Lịch", exact: true }).waitFor();
  await mobile.getByRole("button", { name: "Tháng", exact: true }).click();
  await mobile.locator(".month-grid .month-cell").first().waitFor();
  const horizontalOverflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  assert(!horizontalOverflow, "Calendar month has horizontal overflow on mobile");
  await mobile.screenshot({
    path: path.join(repo, ".artifacts", "g6-g8-mobile-month.png"),
    fullPage: true,
  });
  await mobile.close();
  console.log("G6_E2E_MOBILE_CALENDAR_NO_OVERFLOW=PASS");

  // G7 partial slice: capture offline first, persist a durable IndexedDB mutation,
  // then replay through idempotent /sync/push when the browser reconnects.
  await page
    .getByRole("navigation", { name: "Các màn hình" })
    .getByRole("button", { name: "Công việc" })
    .click();
  await page.getByLabel("Ghi nhanh công việc").waitFor();
  await context.setOffline(true);
  assert(await page.evaluate(() => navigator.onLine === false), "Browser did not go offline");
  await page.getByLabel("Ghi nhanh công việc").fill("E2E offline queued");
  await page.getByRole("button", { name: "Thêm việc" }).click();
  await page.getByText(/1 việc đã lưu trên thiết bị đang chờ đồng bộ/).waitFor();
  let offlineRows = await sql.query(
    "SELECT id FROM tasks WHERE user_id=$1 AND title=$2 AND deleted_at IS NULL",
    [ownerId, "E2E offline queued"],
  );
  assert(offlineRows.rowCount === 0, "Offline task was unexpectedly sent to PostgreSQL");
  await context.setOffline(false);
  const queuedRow = page.locator(".task-item").filter({ hasText: "E2E offline queued" });
  await queuedRow.getByRole("button", { name: "Sửa" }).waitFor();
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll(".task-item")].find((element) =>
      element.textContent?.includes("E2E offline queued"),
    );
    return row?.querySelector("button.task-action")?.hasAttribute("disabled") === false;
  });
  offlineRows = await sql.query(
    "SELECT id FROM tasks WHERE user_id=$1 AND title=$2 AND deleted_at IS NULL",
    [ownerId, "E2E offline queued"],
  );
  assert(offlineRows.rowCount === 1, "Offline task was not persisted exactly once");
  console.log("G7_E2E_OFFLINE_CREATE_RECONNECT_ONCE=PASS");

  // An ambiguous POST response must retain the immutable mutation key until the
  // browser receives a matching acknowledgement on retry. No duplicate creates.
  let droppedOnce = false;
  let resolveCommitted = () => {};
  const committed = new Promise((resolve) => {
    resolveCommitted = resolve;
  });
  await page.route("**/api/sync/push", async (route) => {
    const operation = route.request().postDataJSON()?.operations?.[0];
    if (
      !droppedOnce &&
      operation?.type === "create" &&
      operation.input?.title === "E2E response lost"
    ) {
      droppedOnce = true;
      const accepted = await route.fetch(); // PostgreSQL accepts and commits
      assert(accepted.ok(), "Server did not accept the dropped-response test mutation");
      resolveCommitted();
      await route.abort("failed"); // Response is lost before the browser receives it
    } else {
      await route.continue();
    }
  });
  await page.getByLabel("Ghi nhanh công việc").fill("E2E response lost");
  await page.getByRole("button", { name: "Thêm việc" }).click();
  await page.getByText(/1 việc đã lưu trên thiết bị đang chờ đồng bộ/).waitFor();
  // The queue is rendered as soon as IndexedDB commits; the network request
  // may not have started yet. Await the actual server-commit interception.
  let guardTimer;
  try {
    await Promise.race([
      committed,
      new Promise((_, reject) => {
        guardTimer = setTimeout(
          () => reject(new Error("Dropped-response mutation was never committed")),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(guardTimer);
  }
  assert(droppedOnce, "Dropped-response simulation was not triggered");
  const firstCount = await sql.query(
    "SELECT count(*)::int AS n FROM tasks WHERE user_id=$1 AND title=$2 AND deleted_at IS NULL",
    [ownerId, "E2E response lost"],
  );
  assert(firstCount.rows[0].n === 1, "Server did not accept lost-response create");
  let sawConfirm = false;
  await Promise.all([
    page.waitForEvent("dialog").then(async (dialog) => {
      sawConfirm = dialog.type() === "confirm";
      await dialog.dismiss();
    }),
    page.getByRole("button", { name: "Đăng xuất" }).click(),
  ]);
  assert(sawConfirm, "Pending signout did not prompt the operator");
  await page.getByRole("navigation", { name: "Các màn hình" }).waitFor();
  await page.unroute("**/api/sync/push");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const responseLostRow = page.locator(".task-item").filter({ hasText: "E2E response lost" });
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll(".task-item")].find((element) =>
      element.textContent?.includes("E2E response lost"),
    );
    return row?.querySelector("button.task-action")?.hasAttribute("disabled") === false;
  });
  await responseLostRow.getByRole("button", { name: "Sửa" }).waitFor();
  const retryCount = await sql.query(
    "SELECT count(*)::int AS n FROM tasks WHERE user_id=$1 AND title=$2 AND deleted_at IS NULL",
    [ownerId, "E2E response lost"],
  );
  assert(retryCount.rows[0].n === 1, "Lost response replay created duplicate tasks");
  console.log("G7_E2E_LOST_RESPONSE_RETRY_AND_LOGOUT_GUARD=PASS");

  assert(pageErrors.length === 0, "Browser JS errors: " + pageErrors.join(" | "));
  console.log("G6_G8_BROWSER_TO_POSTGRES_RESULT=PASS");
} finally {
  if (browser) await browser.close().catch(() => {});
  if (vite) await vite.close().catch(() => {});
  if (api) await api.close().catch(() => {});
  if (closeStore) await closeStore().catch(() => {});
  if (sql) await sql.end().catch(() => {});
}
