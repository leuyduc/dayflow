/**
 * DayFlow LOCAL REVIEW, not a production deployment.
 *
 * Runs the real production-built React/PWA bundle, authenticated Fastify API,
 * and a persistent, loopback-only PostgreSQL development database. Local test
 * credentials live in an ignored .artifacts folder; NEVER push/share them.
 *
 * Usage:
 *   npm run demo:local
 *   npm run demo:smoke
 *
 * The isolated database survives a graceful Ctrl+C and subsequent restarts.
 * It cannot read DATABASE_URL or connect to a remote/production PostgreSQL.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "pg";
import { preview } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(root, "apps", "web");
const sandboxRoot = path.join(root, ".artifacts", "postgres-sandbox");
const pgEntry = path.join(sandboxRoot, "node_modules", "embedded-postgres", "dist", "index.js");
const previewRoot = path.join(root, ".artifacts", "dayflow-local-preview");
const pgDir = path.join(previewRoot, "postgres-data");
const secretsFile = path.join(previewRoot, "local-secrets.json");
const loginFile = path.join(previewRoot, "LOGIN-LOCAL-ONLY.txt");
const seededFlag = path.join(previewRoot, "sample-data-created.flag");
function previewPort(variable, fallback) {
  const raw = process.env[variable];
  if (raw === undefined) return fallback;
  if (!/^[0-9]{4,5}$/.test(raw)) throw new Error(variable + " must be a valid local TCP port");
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
    throw new Error(variable + " is outside the allowed local preview port range");
  return port;
}
const uiPort = previewPort("DAYFLOW_PREVIEW_UI_PORT", 5180);
const postgresPort = previewPort("DAYFLOW_PREVIEW_PG_PORT", 55434);
if (uiPort === postgresPort) throw new Error("UI and database preview ports must differ");
const uiOrigin = `http://127.0.0.1:${uiPort}`;
const demoEmail = "demo@dayflow.example.com";
const dbName = "dayflow_test_local_preview";
const appDbRole = "dayflow_dev";
const smokeOnly = process.argv.includes("--smoke");

if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") {
  throw new Error("Local preview refuses external DATABASE_URL or NODE_ENV=production.");
}
if (!existsSync(pgEntry)) {
  throw new Error(
    "Local PostgreSQL test package missing. See docs/DAYFLOW_LOCAL_PREVIEW.md to install it only under .artifacts.",
  );
}
if (!existsSync(path.join(webRoot, "dist", "index.html"))) {
  throw new Error("Production web bundle missing. Run npm run build first.");
}
if (!existsSync(path.join(root, "apps", "api", "dist", "db", "migrate-development.js"))) {
  throw new Error("API bundle missing. Run npm run build first.");
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertUnusedLoopbackPort(port, label) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`${label} port ${port} is busy; nothing stopped`)));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
}

function newSecret() {
  return randomBytes(32).toString("hex");
}

async function loadLocalSecrets() {
  await mkdir(previewRoot, { recursive: true });
  let config;
  if (existsSync(secretsFile)) {
    config = JSON.parse(await readFile(secretsFile, "utf8"));
  } else {
    config = {
      version: 1,
      pgAdminPassword: newSecret(),
      pgAppPassword: newSecret(),
      demoPassword: newSecret(),
      csrfSecret: newSecret(),
      created: new Date().toISOString(),
    };
    await writeFile(secretsFile, JSON.stringify(config, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
  }
  requireCondition(config?.version === 1, "Unsupported local preview credential format");
  for (const key of ["pgAdminPassword", "pgAppPassword", "demoPassword", "csrfSecret"]) {
    requireCondition(
      typeof config[key] === "string" && /^[0-9a-f]{64}$/.test(config[key]),
      "Damaged demo secret file (secrets not displayed): " + key,
    );
  }
  // Plaintext LOCAL TEST credentials intentionally remain inside ignored
  // .artifacts, never in repository docs or source control.
  await writeFile(
    loginFile,
    [
      "DAYFLOW V2 - LOCAL REVIEW ONLY, NEVER PUBLIC/PRODUCTION",
      "URL: " + uiOrigin,
      "Email: " + demoEmail,
      "Password: " + config.demoPassword,
      "",
      "These are test-only credentials for a PostgreSQL sandbox on your own PC.",
      "Never upload/share this file. Keep the CMD window open while using the app.",
      "Stop with Ctrl+C or type q + Enter. Your local review database persists.",
      "",
    ].join("\r\n"),
    { mode: 0o600 },
  );
  return config;
}

function runDevelopmentCommand(filename, databaseUrl, vars) {
  const script = path.join(root, "apps", "api", "dist", "db", filename + ".js");
  const response = spawnSync(process.execPath, [script], {
    cwd: root,
    windowsHide: true,
    timeout: 60_000,
    encoding: "utf8",
    env: {
      ...process.env,
      ...vars,
      DATABASE_URL: databaseUrl,
      DAYFLOW_DB_ENV: "development",
      NODE_ENV: "development",
    },
  });
  if (response.status !== 0) {
    // Do not include stderr in the exception; it may echo process credentials.
    throw new Error("Isolated " + filename + " failed (exit " + response.status + ").");
  }
}

function vietnameseDate(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const components = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (part) => components.find((entry) => entry.type === part)?.value;
  return get("year") + "-" + get("month") + "-" + get("day");
}

let pg;
let pgStarted = false;
let dbClient;
let storeHandle;
let api;
let server;
let shuttingDown = false;

async function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (server) {
    await new Promise((resolve) => server.httpServer.close(resolve)).catch(() => {});
    server = null;
  }
  if (api) {
    await api.close().catch(() => {});
    api = null;
  }
  if (storeHandle) {
    await storeHandle.close().catch(() => {});
    storeHandle = null;
  }
  if (dbClient) {
    await dbClient.end().catch(() => {});
    dbClient = null;
  }
  if (pg && pgStarted) {
    await pg.stop().catch((error) => {
      console.error("Local PostgreSQL shutdown warning:", error?.message ?? String(error));
    });
    pgStarted = false;
    console.log("DAYFLOW_LOCAL_PREVIEW_POSTGRES_STOPPED=PASS");
  }
}

async function smokeBrowser(config, ownerId) {
  const { chromium } = await import("playwright-core");
  const executablePath = [
    process.env.DAYFLOW_BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((candidate) => candidate && existsSync(candidate));
  requireCondition(executablePath, "Chrome/Edge executable missing for local smoke.");
  const browser = await chromium.launch({ executablePath, headless: true });
  let fixtureId = null;
  try {
    const context = await browser.newContext({ viewport: { width: 1365, height: 850 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto(uiOrigin, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.getByRole("form", { name: "Đăng nhập DayFlow" }).waitFor();
    await page.getByLabel("Email").fill(demoEmail);
    await page.getByLabel("Mật khẩu").fill(config.demoPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Các màn hình" });
    await nav.waitFor();
    await nav.getByRole("button", { name: "Công việc" }).click();
    await page.getByText("Hoàn thiện kế hoạch tuần").waitFor();
    console.log("DAYFLOW_LOCAL_PREVIEW_LOGIN_AND_SEEDED_TASKS=PASS");

    const title = "QA demo review " + randomBytes(4).toString("hex");
    await page.getByLabel("Ghi nhanh công việc").fill(title);
    await page.getByRole("button", { name: "Thêm việc" }).click();
    await page.getByText(title).waitFor();
    await page.waitForFunction((text) => {
      const item = [...document.querySelectorAll(".task-item")].find((node) =>
        node.textContent?.includes(text),
      );
      return !!item?.querySelector("button.task-action:not([disabled])");
    }, title);
    const inserted = await dbClient.query(
      "SELECT id, revision FROM tasks WHERE user_id=$1 AND title=$2 AND deleted_at IS NULL",
      [ownerId, title],
    );
    requireCondition(inserted.rowCount === 1, "User-created task did not persist in PostgreSQL");
    fixtureId = inserted.rows[0].id;
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    await page
      .getByRole("navigation", { name: "Các màn hình" })
      .getByRole("button", { name: "Công việc" })
      .click();
    await page.getByText(title).waitFor();
    console.log("DAYFLOW_LOCAL_PREVIEW_CREATE_RELOAD_POSTGRES=PASS");

    await nav.getByRole("button", { name: "Lịch" }).click();
    await page.getByRole("heading", { name: "Lịch", exact: true }).waitFor();
    await page.getByRole("button", { name: "Tháng", exact: true }).click();
    await page.locator(".month-grid .month-cell").first().waitFor();
    await page.screenshot({
      path: path.join(previewRoot, "DAYFLOW_CALENDAR_DESKTOP.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(previewRoot, "DAYFLOW_CALENDAR_MOBILE.png"),
      fullPage: true,
    });
    requireCondition(
      !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
      "Calendar has horizontal overflow on 390px mobile viewport",
    );
    console.log("DAYFLOW_LOCAL_PREVIEW_CALENDAR_DESKTOP_MOBILE=PASS");

    await page
      .getByRole("navigation", { name: "Điều hướng điện thoại" })
      .getByRole("button", { name: "Cài đặt" })
      .click();
    await page.getByRole("heading", { name: "Cài đặt", exact: true }).waitFor();
    await page.getByLabel("Múi giờ").waitFor();
    console.log("DAYFLOW_LOCAL_PREVIEW_SETTINGS_SCREEN=PASS");
    requireCondition(errors.length === 0, "Browser JavaScript error: " + errors.join(" | "));
    console.log("DAYFLOW_LOCAL_PREVIEW_BROWSER_RESULT=PASS");
  } finally {
    if (fixtureId) {
      const result = await dbClient.query(
        "SELECT revision FROM tasks WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
        [fixtureId, ownerId],
      );
      if (result.rows[0]) {
        const removed = await storeHandle.store.push(ownerId, [
          {
            type: "delete",
            taskId: fixtureId,
            expectedRevision: result.rows[0].revision,
            clientMutationId: randomUUID(),
          },
        ]);
        requireCondition(removed[0]?.kind === "ok", "Could not clean demo smoke fixture");
      }
    }
    await browser.close();
  }
}

async function start() {
  await assertUnusedLoopbackPort(postgresPort, "local PostgreSQL");
  await assertUnusedLoopbackPort(uiPort, "local UI");
  const config = await loadLocalSecrets();
  const { default: EmbeddedPostgres } = await import(pathToFileURL(pgEntry).href);
  const newCluster = !existsSync(path.join(pgDir, "PG_VERSION"));
  pg = new EmbeddedPostgres({
    databaseDir: pgDir,
    user: "dayflow_sandbox",
    password: config.pgAdminPassword,
    port: postgresPort,
    persistent: true,
    // Windows default client encoding may be WIN1252. New demo clusters MUST
    // accept Vietnamese Unicode task titles using UTF8.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => {},
  });
  if (newCluster) await pg.initialise();
  await pg.start();
  pgStarted = true;
  console.log(
    newCluster
      ? "DAYFLOW_LOCAL_PREVIEW_POSTGRES_CREATED=PASS"
      : "DAYFLOW_LOCAL_PREVIEW_POSTGRES_REUSED=PASS",
  );

  const admin = pg.getPgClient();
  try {
    await admin.connect();
    const role = await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [appDbRole]);
    if (role.rowCount === 0) {
      await admin.query("CREATE ROLE dayflow_dev LOGIN PASSWORD '" + config.pgAppPassword + "'");
    }
    const database = await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [dbName]);
    if (database.rowCount === 0) {
      await admin.query("CREATE DATABASE " + dbName + " OWNER dayflow_dev");
    }
  } finally {
    await admin.end().catch(() => {});
  }

  const databaseUrl =
    "postgres://dayflow_dev:" + config.pgAppPassword + "@127.0.0.1:" + postgresPort + "/" + dbName;
  runDevelopmentCommand("migrate-development", databaseUrl, {});
  dbClient = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 4000 });
  await dbClient.connect();
  const encoding = await dbClient.query("SHOW server_encoding");
  requireCondition(
    encoding.rows[0]?.server_encoding === "UTF8",
    "Existing local demo database is not UTF8. It was kept unchanged; move it to a backup location before starting a new demo database.",
  );

  const ownerRows = await dbClient.query("SELECT id,email FROM users LIMIT 2");
  if (ownerRows.rowCount === 0) {
    runDevelopmentCommand("bootstrap-owner", databaseUrl, {
      DAYFLOW_OWNER_EMAIL: demoEmail,
      DAYFLOW_OWNER_PASSWORD: config.demoPassword,
      DAYFLOW_BOOTSTRAP_CONFIRM: "YES",
    });
  } else {
    requireCondition(
      ownerRows.rowCount === 1 && ownerRows.rows[0].email === demoEmail,
      "This local database belongs to another account. Refusing to overwrite it.",
    );
  }
  const owner = await dbClient.query("SELECT id FROM users WHERE email=$1", [demoEmail]);
  requireCondition(owner.rowCount === 1, "Local review owner bootstrap failed");
  const ownerId = owner.rows[0].id;
  const { createPostgresStore } = await import(
    pathToFileURL(path.join(root, "apps", "api", "dist", "db", "postgres-store.js")).href
  );
  storeHandle = createPostgresStore(databaseUrl);

  const count = await dbClient.query("SELECT count(*)::int AS n FROM tasks WHERE user_id=$1", [
    ownerId,
  ]);
  if (!existsSync(seededFlag)) {
    if (count.rows[0]?.n === 0) {
      const tasks = [
        {
          title: "Hoàn thiện kế hoạch tuần",
          priority: "high",
          dueDate: vietnameseDate(1),
          estimatedMinutes: 60,
          tags: ["Kế hoạch", "Ưu tiên"],
        },
        {
          title: "Kiểm tra tiến độ công việc",
          priority: "medium",
          dueDate: vietnameseDate(0),
          estimatedMinutes: 30,
          tags: ["Công việc"],
        },
        {
          title: "Chuẩn bị báo cáo và tài liệu",
          priority: "high",
          dueDate: vietnameseDate(3),
          estimatedMinutes: 90,
          tags: ["Báo cáo"],
        },
        {
          title: "Tìm hiểu tính năng lập lịch",
          priority: "low",
          estimatedMinutes: 45,
          tags: ["Học tập"],
        },
        {
          title: "Khám phá DayFlow",
          priority: "medium",
          estimatedMinutes: 20,
          tags: ["Đã xong"],
        },
      ];
      const results = await storeHandle.store.push(
        ownerId,
        tasks.map((task) => ({
          clientMutationId: randomUUID(),
          taskId: randomUUID(),
          type: "create",
          input: task,
        })),
      );
      requireCondition(
        results.every((item) => item.kind === "ok"),
        "Could not create sample tasks",
      );
      const last = results.at(-1);
      const done = await storeHandle.store.push(ownerId, [
        {
          clientMutationId: randomUUID(),
          taskId: last.taskId,
          type: "update",
          expectedRevision: last.revision,
          patch: { status: "completed" },
        },
      ]);
      requireCondition(done[0]?.kind === "ok", "Could not mark a sample task completed");
    }
    await writeFile(seededFlag, "Sample data seeded once; do not delete this marker.\n", {
      flag: "wx",
    });
  }

  const { buildApp } = await import(
    pathToFileURL(path.join(root, "apps", "api", "dist", "app.js")).href
  );
  api = buildApp({
    auth: {
      store: storeHandle.store,
      tasks: storeHandle.store,
      sync: storeHandle.store,
      backup: storeHandle.store,
      settings: storeHandle.store,
      csrfSecret: config.csrfSecret,
      allowedOrigin: uiOrigin,
      cookieSecure: false, // HTTP loopback only, deliberately never production.
    },
  });
  const apiAddress = await api.listen({ host: "127.0.0.1", port: 0 });

  server = await preview({
    root: webRoot,
    configFile: path.join(webRoot, "vite.config.ts"),
    logLevel: "error",
    preview: {
      host: "127.0.0.1",
      port: uiPort,
      strictPort: true,
      proxy: {
        "/api": { target: apiAddress, changeOrigin: true },
      },
    },
  });
  const live = await fetch(uiOrigin + "/api/health");
  requireCondition(live.ok, "Browser origin does not proxy to the local API");
  const body = await live.json();
  requireCondition(body.status === "ok", "Local API health failed");
  const identity = await fetch(uiOrigin + "/api/auth/me");
  requireCondition(identity.status === 401, "Anonymous session was not denied");
  console.log("DAYFLOW_LOCAL_PREVIEW_API_AND_AUTH=PASS");

  if (smokeOnly) {
    await smokeBrowser(config, ownerId);
    return;
  }
  console.log("\n========================================================");
  console.log(" DAYFLOW V2 - WINDOWS LOCAL REVIEW (NOT PRODUCTION)");
  console.log("========================================================");
  console.log(" UI:      " + uiOrigin);
  console.log(" Login:   " + loginFile);
  console.log(" Data:    " + previewRoot);
  console.log(" Access:  This Windows PC only (127.0.0.1)");
  console.log(" Stop:    Ctrl+C or type q then Enter");
  console.log(" WARNING: Do not share .artifacts or expose these ports.");
  console.log("========================================================\n");
  console.log("DAYFLOW_LOCAL_PREVIEW_READY=PASS");

  if (!process.env.DAYFLOW_DEMO_NO_OPEN && process.platform === "win32") {
    const opener = spawn("cmd.exe", ["/d", "/c", "start", "", uiOrigin], {
      windowsHide: true,
      stdio: "ignore",
    });
    opener.on("error", () => {});
    opener.unref();
  }

  await new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
    if (process.stdin.isTTY) {
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (value) => {
        if (String(value).trim().toLowerCase() === "q") resolve();
      });
    }
  });
}

try {
  await start();
} catch (error) {
  // Do not display SQL parameters, task content, passwords or connection URLs.
  const cause = error?.cause;
  const message = String(cause?.message ?? error?.message ?? "Unknown failure")
    .split("\nparams:")[0]
    .split("\n")[0]
    .replaceAll(/postgres:\/\/[^\s]+/g, "[REDACTED_URL]");
  console.error("DayFlow local preview failed:", cause?.code ?? "APP", message);
  process.exitCode = 1;
} finally {
  await stopAll();
}
