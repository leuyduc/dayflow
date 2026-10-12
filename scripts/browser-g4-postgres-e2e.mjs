import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "pg";
import { Algorithm, hash } from "@node-rs/argon2";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(repo, "apps", "web");
const sandbox = path.join(repo, ".artifacts", "postgres-sandbox");
const external = process.env.DAYFLOW_TEST_PG_EXTERNAL === "1";
const adminPass = randomBytes(24).toString("hex");
const rolePass = randomBytes(24).toString("hex");
const ownerPass = randomBytes(24).toString("hex");
const csrfSecret = randomBytes(40).toString("hex");
const databaseName = "dayflow_dev_g4browser";
const connectionString = external
  ? process.env.DATABASE_URL
  : `postgres://dayflow_dev:${rolePass}@127.0.0.1:55433/${databaseName}`;

const appOrigin = "http://127.0.0.1:5174";
const knownChrome = [
  process.env.DAYFLOW_BROWSER_BIN,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((entry) => entry && existsSync(entry));

function assert(value, message) {
  if (!value) throw new Error(message);
}
if (!connectionString) throw new Error("DATABASE_URL missing");
if (external) {
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname).slice(1);
  assert(
    process.env.DAYFLOW_DB_ENV === "development" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      /^dayflow_test_/.test(name) &&
      url.username === "dayflow_dev",
    "External integration requires an isolated localhost test database",
  );
}
if (!knownChrome) throw new Error("Chrome executable not found for real browser integration");

let postgres;
if (!external) {
  const { default: EmbeddedPostgres } = await import(
    pathToFileURL(path.join(sandbox, "node_modules", "embedded-postgres", "dist", "index.js")).href
  );
  postgres = new EmbeddedPostgres({
    databaseDir: path.join(sandbox, "g4-browser-data"),
    port: 55433,
    user: "dayflow_sandbox",
    password: adminPass,
    persistent: false,
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => {},
  });
}
let pgStarted = false;
let admin;
let sql;
let closeStore;
let api;
let vite;
let browser;
try {
  if (postgres) {
    await postgres.initialise();
    await postgres.start();
    pgStarted = true;
    admin = postgres.getPgClient();
    await admin.connect();
    await admin.query("CREATE ROLE dayflow_dev LOGIN PASSWORD '" + rolePass + "'");
    await admin.query("CREATE DATABASE " + databaseName + " OWNER dayflow_dev");
    await admin.end();
    admin = undefined;
  }
  sql = new Client({ connectionString, connectionTimeoutMillis: 4000 });
  await mkdir(path.join(repo, ".artifacts"), { recursive: true });

  const migrateEntry = path.join(repo, "apps", "api", "dist", "db", "migrate-development.js");
  const result = spawnSync(process.execPath, [migrateEntry], {
    cwd: repo,
    encoding: "utf8",
    timeout: 40_000,
    windowsHide: true,
    env: { ...process.env, DATABASE_URL: connectionString, DAYFLOW_DB_ENV: "development" },
  });
  if (result.status !== 0) throw new Error("Isolated development migration failed");
  await sql.connect();

  const ownerEmail = "g4-browser@example.test";
  const secretHash = await hash(ownerPass, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const owner = await sql.query(
    "INSERT INTO users (email,password_hash) VALUES ($1,$2) RETURNING id",
    [ownerEmail, secretHash],
  );
  const ownerId = owner.rows[0]?.id;
  assert(ownerId, "Could not prepare test owner");

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
      port: 5174,
      strictPort: true,
      proxy: { "/api": { target: apiAddress, changeOrigin: true } },
    },
  });
  await vite.listen();
  browser = await chromium.launch({ executablePath: knownChrome, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(appOrigin, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor();
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Mật khẩu").fill(ownerPass);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByLabel("Ghi nhanh công việc").waitFor();
  await page
    .getByRole("navigation", { name: "Các màn hình" })
    .getByRole("button", { name: "Công việc" })
    .click();

  const firstTitle = "G4 end-to-end PostgreSQL real browser";
  await page.getByLabel("Ghi nhanh công việc").fill(firstTitle);
  await page.getByRole("button", { name: "Thêm việc" }).click();
  await page.getByText(firstTitle).waitFor();
  let dbTasks = await sql.query(
    "SELECT id,title,revision FROM tasks WHERE user_id=$1 AND deleted_at IS NULL",
    [ownerId],
  );
  assert(
    dbTasks.rowCount === 1 && dbTasks.rows[0].title === firstTitle,
    "Browser create not persisted",
  );
  console.log("G4_E2E_BROWSER_CREATE_POSTGRES=PASS");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
  await page
    .getByRole("navigation", { name: "Các màn hình" })
    .getByRole("button", { name: "Công việc" })
    .click();
  await page.getByText(firstTitle).waitFor();
  console.log("G4_E2E_SESSION_RESTORE_AND_RELOAD=PASS");

  await page.getByRole("button", { name: "Sửa" }).click();
  const changedTitle = "G4 updated after reload";
  await page.getByLabel("Tiêu đề").fill(changedTitle);
  await page.getByLabel("Mô tả").fill("Real HTTP persisted description");
  await page.getByLabel("Hạn hoàn thành").fill("2026-10-25");
  await page.getByLabel("Độ ưu tiên").selectOption("high");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page.getByText(changedTitle).waitFor();
  dbTasks = await sql.query(
    "SELECT id,title,description,priority,due_date::text AS due_date,revision FROM tasks WHERE user_id=$1 AND deleted_at IS NULL",
    [ownerId],
  );
  assert(
    dbTasks.rowCount === 1 &&
      dbTasks.rows[0].title === changedTitle &&
      dbTasks.rows[0].description === "Real HTTP persisted description" &&
      dbTasks.rows[0].due_date === "2026-10-25" &&
      dbTasks.rows[0].priority === "high" &&
      dbTasks.rows[0].revision === 2,
    "Browser edit not persisted",
  );
  console.log("G4_E2E_BROWSER_EDIT_POSTGRES=PASS");

  await page.getByRole("button", { name: "Hoàn thành " + changedTitle }).click();
  await page.getByRole("button", { name: "Mở lại " + changedTitle }).waitFor();
  await page.getByRole("button", { name: "Mở lại " + changedTitle }).click();
  await page.getByRole("button", { name: "Hoàn thành " + changedTitle }).waitFor();
  dbTasks = await sql.query(
    "SELECT status,completed_at,revision FROM tasks WHERE user_id=$1 AND deleted_at IS NULL",
    [ownerId],
  );
  assert(
    dbTasks.rows[0]?.status === "inbox" &&
      dbTasks.rows[0]?.completed_at === null &&
      dbTasks.rows[0]?.revision === 4,
    "Browser complete/reopen not persisted",
  );
  console.log("G4_E2E_BROWSER_COMPLETE_REOPEN_POSTGRES=PASS");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Xóa" }).click();
  await page.getByText("Chưa có công việc phù hợp").waitFor();
  dbTasks = await sql.query("SELECT deleted_at,revision FROM tasks WHERE user_id=$1", [ownerId]);
  assert(
    dbTasks.rowCount === 1 && !!dbTasks.rows[0].deleted_at && dbTasks.rows[0].revision === 5,
    "Browser soft-delete not persisted",
  );
  console.log("G4_E2E_BROWSER_DELETE_TOMBSTONE_POSTGRES=PASS");

  // G5: two independent authenticated browsers race on one live PostgreSQL task.
  const raceTitle = "G5 two-browser conflict target";
  await page.getByLabel("Ghi nhanh công việc").fill(raceTitle);
  await page.getByRole("button", { name: "Thêm việc" }).click();
  await page.getByText(raceTitle).waitFor();

  const otherContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const otherPage = await otherContext.newPage();
  otherPage.on("pageerror", (e) => pageErrors.push("Second browser: " + e.message));
  await otherPage.goto(appOrigin, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await otherPage.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor();
  await otherPage.getByLabel("Email").fill(ownerEmail);
  await otherPage.getByLabel("Mật khẩu").fill(ownerPass);
  await otherPage.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await otherPage.getByLabel("Ghi nhanh công việc").waitFor();
  await otherPage
    .getByRole("navigation", { name: "Các màn hình" })
    .getByRole("button", { name: "Công việc" })
    .click();
  await otherPage.getByText(raceTitle).waitFor();

  // Browser A retains revision 1 in the open edit form; browser B commits revision 2.
  await page.getByRole("button", { name: "Sửa" }).click();
  await page.getByLabel("Tiêu đề").fill("Draft on browser A");
  await otherPage.getByRole("button", { name: "Sửa" }).click();
  await otherPage.getByLabel("Tiêu đề").fill("Browser B saved version");
  await otherPage.getByRole("button", { name: "Lưu thay đổi" }).click();
  await otherPage.getByText("Browser B saved version").waitFor();
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page.getByText("Xung đột chỉnh sửa — cần lựa chọn").waitFor();
  assert(
    (await page.getByLabel("Tiêu đề").inputValue()) === "Draft on browser A",
    "Browser A conflict silently discarded its local draft",
  );
  await page.getByRole("button", { name: "Giữ bản trên máy chủ" }).click();
  await page.getByText("Browser B saved version").waitFor();
  let raceRows = await sql.query(
    "SELECT title,revision FROM tasks WHERE user_id=$1 AND deleted_at IS NULL",
    [ownerId],
  );
  assert(
    raceRows.rowCount === 1 &&
      raceRows.rows[0].title === "Browser B saved version" &&
      raceRows.rows[0].revision === 2,
    "Choosing the server version must not write browser A stale draft",
  );

  // A second race tests the other explicit choice: reapply A against the CURRENT revision.
  await page.getByRole("button", { name: "Sửa" }).click();
  await page.getByLabel("Tiêu đề").fill("Browser A approved overwrite");
  await otherPage.getByRole("button", { name: "Sửa" }).click();
  await otherPage.getByLabel("Tiêu đề").fill("Browser B second saved version");
  await otherPage.getByRole("button", { name: "Lưu thay đổi" }).click();
  await otherPage.getByText("Browser B second saved version").waitFor();
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page.getByText("Xung đột chỉnh sửa — cần lựa chọn").waitFor();
  assert(
    (await page.getByLabel("Tiêu đề").inputValue()) === "Browser A approved overwrite",
    "Browser A second draft vanished before explicit confirmation",
  );
  await page.getByRole("button", { name: "Ghi đè bằng bản của tôi" }).click();
  await page.getByText("Browser A approved overwrite").waitFor();
  raceRows = await sql.query(
    "SELECT title,revision FROM tasks WHERE user_id=$1 AND deleted_at IS NULL",
    [ownerId],
  );
  assert(
    raceRows.rowCount === 1 &&
      raceRows.rows[0].title === "Browser A approved overwrite" &&
      raceRows.rows[0].revision === 4,
    "Confirmed overwrite did not preserve one atomic revision per accepted write",
  );
  await otherContext.close();
  console.log("G5_TWO_REAL_BROWSERS_EDIT_CONFLICT_AND_EXPLICIT_RESOLUTION=PASS");

  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    "Horizontal overflow on mobile",
  );
  assert(pageErrors.length === 0, "Browser JS errors: " + pageErrors.join(" | "));
  console.log("G4_E2E_MOBILE_AND_RUNTIME=PASS");

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor();
  console.log("G4_E2E_LOGOUT=PASS");
  console.log("G4_FULL_BROWSER_TO_POSTGRES_RESULT=PASS");
} finally {
  if (browser) await browser.close().catch(() => {});
  if (vite) await vite.close().catch(() => {});
  if (api) await api.close().catch(() => {});
  if (closeStore) await closeStore().catch(() => {});
  if (sql) await sql.end().catch(() => {});
  if (admin) await admin.end().catch(() => {});
  if (pgStarted && postgres) {
    await postgres.stop();
    console.log("G4_POSTGRES_CLEAN_SHUTDOWN=PASS");
  }
}
