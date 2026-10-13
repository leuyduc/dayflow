/**
 * Real Chrome → Vite → Fastify → PostgreSQL G7 offline smoke, using the
 * disposable local test database provided by test-g6-g8-postgres-local.mjs.
 * Never run this script against production.
 */
import { randomBytes, randomUUID } from "node:crypto";
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
const appOrigin = "http://127.0.0.1:5176";
const connectionString = process.env.DATABASE_URL;
const knownChrome = [
  process.env.DAYFLOW_BROWSER_BIN,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
].find((file) => file && existsSync(file));
function assert(value, message) {
  if (!value) throw new Error(message);
}
assert(connectionString, "A disposable DATABASE_URL is required");
const url = new URL(connectionString);
assert(
  process.env.DAYFLOW_DB_ENV === "development" &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    /^dayflow_test_g7_/.test(decodeURIComponent(url.pathname).slice(1)) &&
    url.username === "dayflow_dev",
  "Refusing non-isolated G7 database",
);
assert(knownChrome, "A Chrome/Edge executable is required");

const ownerPass = randomBytes(24).toString("hex");
const csrfSecret = randomBytes(40).toString("hex");
let sql;
let closeStore;
let api;
let vite;
let browser;
try {
  const migration = spawnSync(
    process.execPath,
    [path.join(repo, "apps", "api", "dist", "db", "migrate-development.js")],
    {
      cwd: repo,
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, DAYFLOW_DB_ENV: "development", DATABASE_URL: connectionString },
    },
  );
  assert(migration.status === 0, "Isolated development migration failed");
  sql = new Client({ connectionString, connectionTimeoutMillis: 4000 });
  await sql.connect();
  const ownerEmail = "g7-real-browser@example.test";
  const passwordHash = await hash(ownerPass, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const owner = await sql.query(
    "INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id",
    [ownerEmail, passwordHash],
  );
  const ownerId = owner.rows[0].id;
  const updateId = randomUUID();
  const deleteId = randomUUID();
  const conflictId = randomUUID();
  await sql.query(
    "INSERT INTO tasks(id,user_id,title) VALUES($1,$4,'Offline update target'),($2,$4,'Offline delete target'),($3,$4,'Offline conflict target')",
    [updateId, deleteId, conflictId, ownerId],
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
      port: 5176,
      strictPort: true,
      proxy: { "/api": { target: apiAddress, changeOrigin: true } },
    },
  });
  await vite.listen();
  browser = await chromium.launch({ executablePath: knownChrome, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => void dialog.accept());

  await page.goto(appOrigin, { waitUntil: "domcontentloaded" });
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor();
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Mật khẩu").fill(ownerPass);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Các màn hình" });
  await nav.waitFor();
  await nav.getByRole("button", { name: "Công việc" }).click();
  await page.getByText("Offline update target").waitFor();

  // All three operations must be journaled locally before network access resumes.
  await context.setOffline(true);
  await page.getByLabel("Ghi nhanh công việc").fill("Offline captured via Chrome");
  await page.getByRole("button", { name: "Thêm việc" }).click();
  await page.getByText("Offline captured via Chrome").waitFor();
  await page.getByRole("button", { name: "Hoàn thành Offline update target" }).click();
  await page.getByRole("button", { name: "Mở lại Offline update target" }).waitFor();
  const deletion = page.locator(".task-item").filter({ hasText: "Offline delete target" });
  await deletion.getByRole("button", { name: "Xóa" }).click();
  await deletion.waitFor({ state: "detached" });
  const conflictItem = page.locator(".task-item").filter({ hasText: "Offline conflict target" });
  await conflictItem.getByRole("button", { name: "Sửa" }).click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill("My offline conflict edit");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page.getByText("My offline conflict edit").waitFor();
  await page.getByText(/3 chỉnh sửa hoặc xóa đang chờ đồng bộ/).waitFor();
  console.log("G7_CHROME_OFFLINE_CREATE_EDIT_COMPLETE_DELETE_QUEUED=PASS");

  // Mount a new task workspace without reloading the page; the saved queue
  // must survive and no request may reach the server while offline.
  await nav.getByRole("button", { name: "Hôm nay" }).click();
  await nav.getByRole("button", { name: "Công việc" }).click();
  await page.getByText("Offline captured via Chrome").waitFor();
  await page.getByText("My offline conflict edit").waitFor();
  console.log("G7_CHROME_OFFLINE_WORKSPACE_REMOUNT=PASS");

  // Another device writes after this browser went offline; the revision
  // conflict must be preserved for explicit human choice.
  const otherResult = await instance.store.push(ownerId, [
    {
      clientMutationId: randomUUID(),
      taskId: conflictId,
      type: "update",
      expectedRevision: 1,
      patch: { title: "Other device newer change" },
    },
  ]);
  assert(otherResult[0]?.kind === "ok", "Second-device edit did not commit");

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.getByText("Thay đổi offline cần xử lý").waitFor();
  const rows = await sql.query(
    "SELECT id,title,status,revision,deleted_at FROM tasks WHERE user_id=$1",
    [ownerId],
  );
  const byId = new Map(rows.rows.map((record) => [record.id, record]));
  const created = rows.rows.filter((record) => record.title === "Offline captured via Chrome");
  assert(
    created.length === 1 &&
      byId.get(updateId).status === "completed" &&
      byId.get(deleteId).deleted_at !== null &&
      byId.get(conflictId).title === "Other device newer change" &&
      byId.get(conflictId).revision === 2,
    "Offline replay failed or overwrote a concurrent server edit",
  );
  console.log("G7_CHROME_RECONNECT_CRUD_AND_CONFLICT_PRESERVED_POSTGRES=PASS");

  // An explicit user decision must produce a NEW mutation id and revision.
  await page.getByRole("button", { name: "Áp dụng lại theo lựa chọn của tôi" }).click();
  await page.getByText("My offline conflict edit").waitFor();
  await page
    .getByRole("heading", { name: "Thay đổi offline cần xử lý" })
    .waitFor({ state: "detached" });
  const resolved = await sql.query("SELECT title,revision FROM tasks WHERE id=$1 AND user_id=$2", [
    conflictId,
    ownerId,
  ]);
  assert(
    resolved.rows[0]?.title === "My offline conflict edit" && resolved.rows[0]?.revision === 3,
    "Explicit conflict override was not persisted",
  );
  console.log("G7_CHROME_EXPLICIT_CONFLICT_RESOLUTION_POSTGRES=PASS");

  // Simulate a response lost AFTER the server commits a create. Retry must
  // carry the same idempotency key; PostgreSQL must hold exactly one row.
  let lostKey;
  await page.route("**/api/sync/push", async (route) => {
    const posted = route.request().postDataJSON();
    const op = posted?.operations?.[0];
    if (op?.type === "create" && op?.input?.title === "Lost-response create" && !lostKey) {
      lostKey = op.clientMutationId;
      const response = await route.fetch();
      assert(response.ok(), "Server refused simulated lost-response create");
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });
  await page.getByLabel("Ghi nhanh công việc").fill("Lost-response create");
  await page.getByRole("button", { name: "Thêm việc" }).click();
  await page.getByText("Lost-response create").waitFor();
  await page.getByText(/việc đã lưu trên thiết bị đang chờ đồng bộ/).waitFor();
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Đồng bộ ngay" }).click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector("section[aria-label='Quản lý công việc']")
        ?.textContent?.includes("việc đã lưu trên thiết bị đang chờ đồng bộ"),
  );
  const once = await sql.query(
    "SELECT count(*)::int AS n FROM tasks WHERE user_id=$1 AND title='Lost-response create' AND deleted_at IS NULL",
    [ownerId],
  );
  assert(lostKey && once.rows[0]?.n === 1, "Lost-response retry created a duplicate");
  console.log("G7_CHROME_DROPPED_RESPONSE_REPLAY_IDEMPOTENT_POSTGRES=PASS");

  // Two tabs for the same owner enqueue independently while offline. On
  // reconnect both tabs may replay the full shared Dexie outbox at once;
  // server idempotency must commit each task once without losing either.
  const tabB = await context.newPage();
  tabB.on("pageerror", (error) => errors.push("tab B: " + error.message));
  await tabB.goto(appOrigin, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await tabB
    .getByRole("navigation", { name: "Các màn hình" })
    .getByRole("button", { name: "Công việc" })
    .click();
  await tabB.getByLabel("Ghi nhanh công việc").waitFor();
  await context.setOffline(true);
  await page.getByLabel("Ghi nhanh công việc").fill("Parallel offline A");
  await page.getByRole("button", { name: "Thêm việc" }).click();
  await page.getByText("Parallel offline A").waitFor();
  await tabB.getByLabel("Ghi nhanh công việc").fill("Parallel offline B");
  await tabB.getByRole("button", { name: "Thêm việc" }).click();
  await tabB.getByText("Parallel offline B").waitFor();
  const queuedBefore = await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("dayflow-v2-offline");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const records = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
        records.onerror = () => reject(records.error);
        records.onsuccess = () => {
          db.close();
          resolve(records.result.filter((item) => item.title.startsWith("Parallel offline")));
        };
      };
    });
  });
  assert(queuedBefore.length === 2, "Parallel tabs did not persist both offline tasks");
  assert(
    new Set(queuedBefore.map((item) => item.clientMutationId)).size === 2,
    "Parallel offline tasks reused an idempotency key",
  );
  await context.setOffline(false);
  await Promise.all([
    page.evaluate(() => window.dispatchEvent(new Event("online"))),
    tabB.evaluate(() => window.dispatchEvent(new Event("online"))),
  ]);
  let simultaneousCount = 0;
  for (let attempt = 0; attempt < 35; attempt++) {
    const check = await sql.query(
      "SELECT count(*)::int AS n FROM tasks WHERE user_id=$1 AND title IN ('Parallel offline A','Parallel offline B') AND deleted_at IS NULL",
      [ownerId],
    );
    simultaneousCount = check.rows[0].n;
    if (simultaneousCount === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(simultaneousCount === 2, "Two-tab simultaneous replay lost or duplicated task writes");
  const remaining = await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("dayflow-v2-offline");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const records = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
        records.onerror = () => reject(records.error);
        records.onsuccess = () => {
          db.close();
          resolve(records.result.filter((item) => item.title.startsWith("Parallel offline")));
        };
      };
    });
  });
  assert(remaining.length === 0, "Two-tab replay left acknowledged operations in the outbox");
  await tabB.close();
  console.log("G7_TWO_TAB_CONCURRENT_REPLAY_NO_LOST_OR_DUPLICATE_WRITES=PASS");

  // G7: even ONLINE quick status and delete writes are persisted before HTTP.
  // Deliberately lose a successful response AFTER PostgreSQL commits; replay
  // must use the same mutation ID and the server revision must only increment once.
  async function createOnlineFixture(title) {
    await page.getByLabel("Ghi nhanh công việc").fill(title);
    await page.getByRole("button", { name: "Thêm việc" }).click();
    const row = page.locator(".task-item").filter({ hasText: title });
    await row.getByRole("button", { name: "Sửa" }).waitFor();
    await page.waitForFunction((taskTitle) => {
      const item = [...document.querySelectorAll(".task-item")].find((node) =>
        node.textContent?.includes(taskTitle),
      );
      return !!item?.querySelector("button.task-action:not([disabled])");
    }, title);
    const created = await sql.query(
      "SELECT id,revision FROM tasks WHERE user_id=$1 AND title=$2 AND deleted_at IS NULL",
      [ownerId, title],
    );
    assert(
      created.rowCount === 1 && created.rows[0].revision === 1,
      "Online E2E fixture was not persisted exactly once",
    );
    return created.rows[0].id;
  }

  const lostStatusTitle = "Online complete response lost";
  const lostStatusId = await createOnlineFixture(lostStatusTitle);
  const onlineStatusKeys = [];
  await page.route("**/api/sync/push", async (route) => {
    const op = route.request().postDataJSON()?.operations?.[0];
    if (op?.type === "update" && op.taskId === lostStatusId && op.patch?.status === "completed") {
      onlineStatusKeys.push(op.clientMutationId);
      if (onlineStatusKeys.length === 1) {
        const response = await route.fetch();
        assert(response.ok(), "Server did not commit online completion");
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Hoàn thành " + lostStatusTitle }).click();
  await page.getByText(/chỉnh sửa hoặc xóa đang chờ đồng bộ/).waitFor();
  await page.getByRole("button", { name: "Đồng bộ ngay" }).click();
  await page.waitForFunction((title) => {
    const item = [...document.querySelectorAll(".task-item")].find((node) =>
      node.textContent?.includes(title),
    );
    return (
      !!item?.querySelector("button.completion:not([disabled])") &&
      !document
        .querySelector("section[aria-label='Quản lý công việc']")
        ?.textContent?.includes("chỉnh sửa hoặc xóa đang chờ đồng bộ")
    );
  }, lostStatusTitle);
  const statusRow = await sql.query(
    "SELECT status,revision FROM tasks WHERE id=$1 AND user_id=$2",
    [lostStatusId, ownerId],
  );
  assert(
    onlineStatusKeys.length >= 2 &&
      onlineStatusKeys.every((id) => id === onlineStatusKeys[0]) &&
      statusRow.rows[0]?.status === "completed" &&
      statusRow.rows[0]?.revision === 2,
    "Lost-response online completion replay lost idempotency or double-committed",
  );
  await page.unrouteAll({ behavior: "wait" });
  console.log("G7_ONLINE_COMPLETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS");

  const lostDeleteTitle = "Online delete response lost";
  const lostDeleteId = await createOnlineFixture(lostDeleteTitle);
  const onlineDeleteKeys = [];
  await page.route("**/api/sync/push", async (route) => {
    const op = route.request().postDataJSON()?.operations?.[0];
    if (op?.type === "delete" && op.taskId === lostDeleteId) {
      onlineDeleteKeys.push(op.clientMutationId);
      if (onlineDeleteKeys.length === 1) {
        const response = await route.fetch();
        assert(response.ok(), "Server did not commit online deletion");
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  const deletedRow = page.locator(".task-item").filter({ hasText: lostDeleteTitle });
  await deletedRow.getByRole("button", { name: "Xóa" }).click();
  await page.getByText(/chỉnh sửa hoặc xóa đang chờ đồng bộ/).waitFor();
  await page.getByRole("button", { name: "Đồng bộ ngay" }).click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector("section[aria-label='Quản lý công việc']")
        ?.textContent?.includes("chỉnh sửa hoặc xóa đang chờ đồng bộ"),
  );
  const deleteRow = await sql.query(
    "SELECT revision,deleted_at FROM tasks WHERE id=$1 AND user_id=$2",
    [lostDeleteId, ownerId],
  );
  assert(
    onlineDeleteKeys.length >= 2 &&
      onlineDeleteKeys.every((id) => id === onlineDeleteKeys[0]) &&
      deleteRow.rows[0]?.revision === 2 &&
      deleteRow.rows[0]?.deleted_at,
    "Lost-response online delete replay lost idempotency or double-deleted",
  );
  await page.unrouteAll({ behavior: "wait" });
  console.log("G7_ONLINE_DELETE_RESPONSE_LOST_SAME_KEY_REPLAY=PASS");

  // Full form edit must have the same durable guarantee as quick actions.
  // A successful server commit with a deliberately lost HTTP response must
  // replay the identical mutation UUID and must NOT double-edit the task.
  const lostFormTitle = "Online full form lost response";
  const lostFormId = await createOnlineFixture(lostFormTitle);
  const editedFormTitle = "Online full form saved despite response loss";
  const onlineFormKeys = [];
  await page.route("**/api/sync/push", async (route) => {
    const op = route.request().postDataJSON()?.operations?.[0];
    if (op?.type === "update" && op.taskId === lostFormId && op.patch?.title === editedFormTitle) {
      onlineFormKeys.push(op.clientMutationId);
      if (onlineFormKeys.length === 1) {
        const response = await route.fetch();
        assert(response.ok(), "Server did not commit the online full-form edit");
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  const formRow = page.locator(".task-item").filter({ hasText: lostFormTitle });
  await formRow.getByRole("button", { name: "Sửa" }).click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill(editedFormTitle);
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page.getByText(/chỉnh sửa hoặc xóa đang chờ đồng bộ/).waitFor();
  await page.getByRole("button", { name: "Đồng bộ ngay" }).click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector("section[aria-label='Quản lý công việc']")
        ?.textContent?.includes("chỉnh sửa hoặc xóa đang chờ đồng bộ"),
  );
  const formResult = await sql.query(
    "SELECT title,revision FROM tasks WHERE id=$1 AND user_id=$2",
    [lostFormId, ownerId],
  );
  assert(
    onlineFormKeys.length >= 2 &&
      onlineFormKeys.every((id) => id === onlineFormKeys[0]) &&
      formResult.rows[0]?.title === editedFormTitle &&
      formResult.rows[0]?.revision === 2,
    "Full-form edit replay generated a new key, lost the draft or double-committed",
  );
  await page.unrouteAll({ behavior: "wait" });
  const closeEdit = page.getByRole("button", { name: "Hủy", exact: true });
  if (await closeEdit.count()) await closeEdit.click();
  console.log("G7_ONLINE_FORM_EDIT_RESPONSE_LOST_SAME_KEY_REPLAY=PASS");

  await mkdir(path.join(repo, ".artifacts"), { recursive: true });
  await page.screenshot({
    path: path.join(repo, ".artifacts", "g7-online-after-recovery.png"),
    fullPage: true,
  });
  // Simulate account switch in the SAME browser origin. The outbox belongs
  // to owner A, but cookie+CSRF now authenticate owner B. The durable replay
  // must be rejected before any B-scoped task can be written.
  const secondEmail = "g7-second-owner@example.test";
  const second = await sql.query(
    "INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id",
    [secondEmail, passwordHash],
  );
  const otherOwnerId = second.rows[0].id;
  const crossAccount = await page.evaluate(
    async ({ email, password, oldOwnerId }) => {
      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!login.ok) return { loginStatus: login.status, status: null, payload: null };
      const session = await login.json();
      const replay = await fetch("/api/sync/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Dayflow-CSRF": session.csrfToken,
          "X-Dayflow-Owner": oldOwnerId,
        },
        body: JSON.stringify({
          operations: [
            {
              clientMutationId: crypto.randomUUID(),
              type: "create",
              taskId: crypto.randomUUID(),
              input: { title: "FORBIDDEN cross-owner queued task" },
            },
          ],
        }),
      });
      const bootstrap = await fetch("/api/sync/bootstrap", {
        headers: { "X-Dayflow-Owner": oldOwnerId },
      });
      const pull = await fetch("/api/sync/pull?cursor=0", {
        headers: { "X-Dayflow-Owner": oldOwnerId },
      });
      return {
        loginStatus: login.status,
        status: replay.status,
        payload: await replay.json(),
        bootstrapStatus: bootstrap.status,
        pullStatus: pull.status,
      };
    },
    { email: secondEmail, password: ownerPass, oldOwnerId: ownerId },
  );
  assert(
    crossAccount.loginStatus === 200 &&
      crossAccount.status === 403 &&
      crossAccount.bootstrapStatus === 403 &&
      crossAccount.pullStatus === 403 &&
      crossAccount.payload?.error === "owner-session-mismatch",
    "Old owner outbox replay was not rejected under second-owner session",
  );
  const leakage = await sql.query("SELECT count(*)::int AS n FROM tasks WHERE user_id=$1", [
    otherOwnerId,
  ]);
  assert(leakage.rows[0].n === 0, "Second owner received another owner's pending task");
  console.log("G7_OWNER_BOUND_OUTBOX_REPLAY_REJECTED_AFTER_ACCOUNT_SWITCH=PASS");

  // Focus the old owner-A tab after owner B has replaced the session cookie.
  // The app must unmount owner A's private UI rather than leave it visible.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor();
  assert(
    (await page.getByLabel("Ghi nhanh công việc").count()) === 0,
    "Old owner task workspace remained visible under the other account's cookie",
  );
  console.log("G7_STALE_TAB_PRIVATE_VIEW_HIDDEN_AFTER_ACCOUNT_SWITCH=PASS");

  assert(errors.length === 0, "JavaScript errors: " + errors.join(" | "));
  console.log("G7_REAL_CHROME_POSTGRES_PARTIAL_OFFLINE_RESULT=PASS");
} finally {
  if (browser) await browser.close().catch(() => {});
  if (vite) await vite.close().catch(() => {});
  if (api) await api.close().catch(() => {});
  if (closeStore) await closeStore().catch(() => {});
  if (sql) await sql.end().catch(() => {});
}
