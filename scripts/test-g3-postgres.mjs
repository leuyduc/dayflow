import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = path.join(repo, ".artifacts", "postgres-sandbox");
const useExternal = process.env.DAYFLOW_TEST_PG_EXTERNAL === "1";
const { default: EmbeddedPostgres } = useExternal
  ? { default: null }
  : await import(
      pathToFileURL(path.join(sandbox, "node_modules", "embedded-postgres", "dist", "index.js"))
        .href
    );
const adminPass = randomBytes(24).toString("hex");
const devPass = randomBytes(24).toString("hex");
const ownerPass = randomBytes(24).toString("hex");
const csrfSecret = randomBytes(40).toString("hex");
const dbName = "dayflow_dev_g3";
const url = useExternal
  ? process.env.DATABASE_URL
  : "postgres://dayflow_dev:" + devPass + "@127.0.0.1:55432/" + dbName;
if (!url) throw new Error("DATABASE_URL missing");
if (useExternal) {
  const parsed = new URL(url);
  const databaseName = decodeURIComponent(parsed.pathname).slice(1);
  if (
    process.env.DAYFLOW_DB_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    !/^dayflow_test_/.test(databaseName) ||
    parsed.username !== "dayflow_dev"
  ) {
    throw new Error(
      "External test requires a dedicated loopback dayflow_test_ database and dev role",
    );
  }
}

function must(ok, text) {
  if (!ok) throw new Error(text);
}
function runDevScript(name, vars, expectedFailure = false) {
  const entry = path.join(repo, "apps", "api", "dist", "db", name + ".js");
  const result = spawnSync(process.execPath, [entry], {
    cwd: repo,
    encoding: "utf8",
    timeout: 40_000,
    windowsHide: true,
    env: { ...process.env, DATABASE_URL: url, DAYFLOW_DB_ENV: "development", ...vars },
  });
  if (expectedFailure) {
    must(result.status !== 0, name + " unexpectedly succeeded");
    console.log(name.toUpperCase().replaceAll("-", "_") + "_REPEAT_DENIED=PASS");
    return;
  }
  if (result.status !== 0) {
    const details = String(result.stderr || result.stdout || "unknown error")
      .replaceAll(url, "[REDACTED-URL]")
      .replaceAll(ownerPass, "[REDACTED]");
    throw new Error(name + " failed: " + details.slice(-2000));
  }
  console.log(name.toUpperCase().replaceAll("-", "_") + "=PASS");
}

const postgres = useExternal
  ? null
  : new EmbeddedPostgres({
      databaseDir: path.join(sandbox, "integration-db"),
      user: "dayflow_sandbox",
      password: adminPass,
      port: 55432,
      persistent: false,
      postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
      onLog: () => {},
    });

let serverStarted = false;
let admin;
let client;
let app;
let closeStore;
try {
  if (!useExternal) {
    await postgres.initialise();
    await postgres.start();
    serverStarted = true;
    console.log("POSTGRES_17_LOCALHOST_STARTED=PASS");

    admin = postgres.getPgClient();
    await admin.connect();
    await admin.query("CREATE ROLE dayflow_dev LOGIN PASSWORD '" + devPass + "'");
    await admin.query("CREATE DATABASE " + dbName + " OWNER dayflow_dev");
    await admin.end();
    admin = undefined;
  } else {
    console.log("EXTERNAL_LOOPBACK_TEST_DATABASE_CONFIRMED=PASS");
  }

  runDevScript("migrate-development", {});
  runDevScript("migrate-development", {});
  console.log("MIGRATION_REPLAY_IDEMPOTENT=PASS");
  const database = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
  client = database;
  await database.connect();
  const tables = await database.query(
    "select tablename from pg_tables where schemaname='public' and tablename in ('users','sessions','tasks','settings') order by tablename",
  );
  must(
    tables.rows.map((r) => r.tablename).join(",") === "sessions,settings,tasks,users",
    "Missing tables",
  );
  console.log("REAL_POSTGRES_MIGRATION_4_TABLES=PASS");

  runDevScript("bootstrap-owner", {
    DAYFLOW_OWNER_EMAIL: "owner.g3@example.test",
    DAYFLOW_OWNER_PASSWORD: ownerPass,
    DAYFLOW_BOOTSTRAP_CONFIRM: "YES",
  });
  const owners = await database.query("select id from users where email=$1", [
    "owner.g3@example.test",
  ]);
  must(owners.rowCount === 1, "Owner bootstrap failed");
  runDevScript(
    "bootstrap-owner",
    {
      DAYFLOW_OWNER_EMAIL: "owner.g3@example.test",
      DAYFLOW_OWNER_PASSWORD: ownerPass,
      DAYFLOW_BOOTSTRAP_CONFIRM: "YES",
    },
    true,
  );
  const owner = owners.rows[0].id;
  console.log("REAL_POSTGRES_OWNER_BOOTSTRAP=PASS");

  const secondaryId = "22222222-2222-4222-8222-222222222222";
  await database.query("insert into users (id,email,password_hash) values ($1,$2,$3)", [
    secondaryId,
    "other.g3@example.test",
    "test-placeholder-not-login-valid",
  ]);
  await database.query("insert into tasks (user_id,title) values ($1,$2)", [owner, "owner task"]);
  await database.query("insert into tasks (user_id,title) values ($1,$2)", [
    secondaryId,
    "different owner task",
  ]);

  const { createPostgresStore } = await import(
    pathToFileURL(path.join(repo, "apps/api/dist/db/postgres-store.js")).href
  );
  const { buildApp } = await import(pathToFileURL(path.join(repo, "apps/api/dist/app.js")).href);
  const { store, close } = createPostgresStore(url);
  closeStore = close;
  app = buildApp({
    auth: { store, csrfSecret, allowedOrigin: "http://127.0.0.1:5173", now: () => new Date() },
  });
  await app.ready();
  const httpAddress = await app.listen({ host: "127.0.0.1", port: 0 });
  const httpLogin = await fetch(httpAddress + "/api/auth/login", {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1:5173",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: "owner.g3@example.test", password: ownerPass }),
  });
  must(httpLogin.status === 200, "Real HTTP login failed");
  const httpCookie = String(httpLogin.headers.get("set-cookie")).split(";")[0];
  const httpTasks = await fetch(httpAddress + "/api/tasks", {
    headers: { cookie: httpCookie },
  });
  const httpTasksBody = await httpTasks.json();
  must(
    httpTasks.status === 200 &&
      httpTasksBody.tasks.length === 1 &&
      httpTasksBody.tasks[0].title === "owner task",
    "Real HTTP owner scoping failed",
  );
  console.log("REAL_HTTP_POSTGRES_COOKIE_AUTH=PASS");

  const anon = await app.inject("/api/tasks");
  must(anon.statusCode === 401, "Anonymous task request not blocked");
  const bad = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: "http://127.0.0.1:5173" },
    payload: { email: "owner.g3@example.test", password: "wrongPassword123" },
  });
  must(bad.statusCode === 401, "Incorrect password accepted");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: "http://127.0.0.1:5173" },
    payload: { email: "owner.g3@example.test", password: ownerPass },
  });
  must(login.statusCode === 200, "Real database login failed: " + login.statusCode);
  const cookie = String(login.headers["set-cookie"]).split(";")[0];
  must(cookie.includes("dayflow_session="), "Missing session cookie");
  const me = await app.inject({ url: "/api/auth/me", headers: { cookie } });
  must(me.statusCode === 200 && me.json().user.id === owner, "Session owner mismatch");
  const tasks = await app.inject({ url: "/api/tasks", headers: { cookie } });
  must(
    tasks.statusCode === 200 &&
      tasks.json().tasks.length === 1 &&
      tasks.json().tasks[0].title === "owner task",
    "Owner task scoping failed",
  );
  console.log("REAL_POSTGRES_LOGIN_AND_OWNER_ISOLATION=PASS");

  const csrf = me.json().csrfToken;
  const noCsrf = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { cookie, origin: "http://127.0.0.1:5173" },
  });
  must(noCsrf.statusCode === 403, "Missing CSRF accepted");
  const logout = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { cookie, origin: "http://127.0.0.1:5173", "x-dayflow-csrf": csrf },
  });
  must(logout.statusCode === 200, "Logout failed");
  const revoked = await app.inject({ url: "/api/auth/me", headers: { cookie } });
  must(revoked.statusCode === 401, "Revoked session was accepted");
  console.log("REAL_POSTGRES_SESSION_REVOCATION_CSRF=PASS");

  console.log("G3_LIVE_POSTGRES_RESULT=PASS");
} finally {
  if (app) await app.close().catch(() => {});
  if (closeStore) await closeStore().catch(() => {});
  if (client) await client.end().catch(() => {});
  if (admin) await admin.end().catch(() => {});
  if (serverStarted && postgres) {
    await postgres.stop();
    console.log("POSTGRES_STOP_CLEAN=PASS");
  }
}
