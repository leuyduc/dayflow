import { Client } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
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
    auth: {
      store,
      tasks: store,
      sync: store,
      csrfSecret,
      allowedOrigin: "http://127.0.0.1:5173",
      now: () => new Date(),
    },
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
  // G4: exercise actual HTTP + cookie + CSRF + Drizzle + PostgreSQL.
  const httpSession = await httpLogin.json();
  const mutationHeaders = {
    cookie: httpCookie,
    origin: "http://127.0.0.1:5173",
    "content-type": "application/json",
    "x-dayflow-csrf": httpSession.csrfToken,
  };
  async function mutate(method, route, payload, headers = mutationHeaders) {
    return fetch(httpAddress + route, {
      method,
      headers,
      body: JSON.stringify(payload),
    });
  }
  const invalidCreate = await mutate("POST", "/api/tasks", { title: " " });
  must(invalidCreate.status === 400, "Empty task title must be rejected");
  const missingCsrf = await mutate(
    "POST",
    "/api/tasks",
    { title: "forged" },
    {
      cookie: httpCookie,
      origin: "http://127.0.0.1:5173",
      "content-type": "application/json",
    },
  );
  must(missingCsrf.status === 403, "Missing task CSRF was accepted");
  const invalidOrigin = await mutate(
    "POST",
    "/api/tasks",
    { title: "forged" },
    {
      ...mutationHeaders,
      origin: "https://evil.invalid",
    },
  );
  must(invalidOrigin.status === 403, "Invalid task Origin was accepted");
  const created = await mutate("POST", "/api/tasks", {
    title: "Real PostgreSQL G4 task",
    priority: "high",
    dueDate: "2026-10-25",
  });
  must(created.status === 201, "G4 create failed: " + created.status);
  const g4task = (await created.json()).task;
  must(g4task.revision === 1 && g4task.priority === "high", "Incorrect task creation");
  const foreign = await database.query("select id from tasks where user_id=$1", [secondaryId]);
  const foreignId = foreign.rows[0]?.id;
  must(!!foreignId, "Missing other owner fixture");
  must(
    (
      await mutate("PATCH", "/api/tasks/" + foreignId, {
        expectedRevision: 1,
        title: "Not authorized",
      })
    ).status === 404,
    "Cross-owner update leaked",
  );
  must(
    (await mutate("DELETE", "/api/tasks/" + foreignId, { expectedRevision: 1 })).status === 404,
    "Cross-owner deletion leaked",
  );
  const updated = await mutate("PATCH", "/api/tasks/" + g4task.id, {
    expectedRevision: 1,
    title: "G4 updated",
    description: "Stored for real",
  });
  must(updated.status === 200 && (await updated.json()).task.revision === 2, "G4 update failed");
  must(
    (
      await mutate("PATCH", "/api/tasks/" + g4task.id, {
        expectedRevision: 1,
        title: "Stale",
      })
    ).status === 409,
    "Stale revision was accepted",
  );
  const completed = await mutate("PATCH", "/api/tasks/" + g4task.id, {
    expectedRevision: 2,
    status: "completed",
  });
  const completedTask = (await completed.json()).task;
  must(completed.status === 200 && !!completedTask.completedAt, "Complete failed");
  const reopened = await mutate("PATCH", "/api/tasks/" + g4task.id, {
    expectedRevision: 3,
    status: "inbox",
  });
  must(
    reopened.status === 200 && (await reopened.json()).task.completedAt === null,
    "Reopen failed",
  );
  const removed = await mutate("DELETE", "/api/tasks/" + g4task.id, { expectedRevision: 4 });
  must(removed.status === 200, "G4 delete failed");
  must(
    (await mutate("DELETE", "/api/tasks/" + g4task.id, { expectedRevision: 5 })).status === 404,
    "Repeated deletion should not reapply",
  );
  const tombstone = await database.query(
    "select deleted_at is not null as deleted, revision from tasks where id=$1",
    [g4task.id],
  );
  must(
    tombstone.rows[0]?.deleted === true && tombstone.rows[0]?.revision === 5,
    "Deletion did not preserve versioned tombstone",
  );
  const isolatedTasks = await fetch(httpAddress + "/api/tasks", {
    headers: { cookie: httpCookie },
  });
  must(
    isolatedTasks.status === 200 && (await isolatedTasks.json()).tasks.length === 1,
    "Owner list incorrectly includes other user's task or deleted task",
  );
  console.log("G4_REAL_HTTP_POSTGRES_CRUD_OWNER_REVISION_TOMBSTONE=PASS");

  // G5: real PostgreSQL, two authenticated sessions representing devices A/B.
  // These sessions share the same owner account, but do not share client state.
  const deviceB = await fetch(httpAddress + "/api/auth/login", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:5173", "content-type": "application/json" },
    body: JSON.stringify({ email: "owner.g3@example.test", password: ownerPass }),
  });
  must(deviceB.status === 200, "Device B login failed");
  const deviceBCookie = String(deviceB.headers.get("set-cookie")).split(";")[0];
  const deviceBSession = await deviceB.json();
  const deviceHeaders = (cookie, csrf) => ({
    cookie,
    origin: "http://127.0.0.1:5173",
    "content-type": "application/json",
    "x-dayflow-csrf": csrf,
  });
  const fetchSync = async (method, path, cookie, operations, csrf) => {
    const response = await fetch(httpAddress + path, {
      method,
      headers: method === "GET" ? { cookie } : deviceHeaders(cookie, csrf),
      ...(method === "POST" ? { body: JSON.stringify({ operations }) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const aBootstrap = await fetchSync("GET", "/api/sync/bootstrap", httpCookie);
  const bBootstrap = await fetchSync("GET", "/api/sync/bootstrap", deviceBCookie);
  must(
    aBootstrap.status === 200 &&
      bBootstrap.status === 200 &&
      aBootstrap.body.cursor === bBootstrap.body.cursor &&
      aBootstrap.body.tasks.length === 1 &&
      bBootstrap.body.tasks.length === 1,
    "Two-device bootstrap diverged",
  );
  const cursorBefore = aBootstrap.body.cursor;
  console.log("G5_TWO_DEVICES_SNAPSHOT=PASS");

  const syncedId = randomUUID();
  const acceptedId = randomUUID();
  const syncCreate = {
    clientMutationId: acceptedId,
    type: "create",
    taskId: syncedId,
    input: { title: "Created on device A", priority: "high", dueDate: "2026-11-01" },
  };
  const first = await fetchSync(
    "POST",
    "/api/sync/push",
    httpCookie,
    [syncCreate],
    httpSession.csrfToken,
  );
  must(first.status === 200 && first.body.results[0]?.kind === "ok", "Device A sync create failed");
  const firstCursor = first.body.results[0].cursor;
  must(firstCursor === cursorBefore + 1, "Sync cursor did not advance exactly once");
  const retry = await fetchSync(
    "POST",
    "/api/sync/push",
    httpCookie,
    [syncCreate],
    httpSession.csrfToken,
  );
  must(
    retry.status === 200 &&
      retry.body.results[0]?.kind === "ok" &&
      retry.body.results[0]?.cursor === firstCursor &&
      retry.body.results[0]?.taskId === syncedId &&
      retry.body.results[0]?.revision === first.body.results[0]?.revision &&
      retry.body.results[0]?.task?.title === first.body.results[0]?.task?.title,
    "Idempotent retry changed original result",
  );
  const misuse = await fetchSync(
    "POST",
    "/api/sync/push",
    httpCookie,
    [{ ...syncCreate, input: { title: "Mutation ID reused with other payload" } }],
    httpSession.csrfToken,
  );
  must(
    misuse.body.results[0]?.kind === "idempotency-key-reused",
    "Mutation ID reuse with different payload accepted",
  );
  const countOne = await database.query(
    "select count(*)::int AS count from change_log where user_id=$1 AND entity_id=$2",
    [owner, syncedId],
  );
  must(countOne.rows[0]?.count === 1, "Retry appended duplicate change");
  console.log("G5_IDEMPOTENT_RETRY_AND_PAYLOAD_FINGERPRINT=PASS");

  const delta = await fetchSync("GET", "/api/sync/pull?cursor=" + cursorBefore, deviceBCookie);
  must(
    delta.status === 200 &&
      delta.body.changes.length === 1 &&
      delta.body.changes[0].operation === "create" &&
      delta.body.changes[0].payload.title === "Created on device A" &&
      delta.body.nextCursor === firstCursor,
    "Device B missed committed change",
  );
  const pageOne = await fetchSync("GET", "/api/sync/pull?cursor=0&limit=2", deviceBCookie);
  must(
    pageOne.status === 200 && pageOne.body.changes.length <= 2,
    "Paginated sync page limit ignored",
  );
  console.log("G5_ONLINE_PULL_A_TO_B_WITH_PAGINATION=PASS");

  const sameRevisionA = {
    clientMutationId: randomUUID(),
    type: "update",
    taskId: syncedId,
    expectedRevision: 1,
    patch: { title: "Device A edit" },
  };
  const sameRevisionB = {
    clientMutationId: randomUUID(),
    type: "update",
    taskId: syncedId,
    expectedRevision: 1,
    patch: { title: "Device B edit" },
  };
  const [raceA, raceB] = await Promise.all([
    fetchSync("POST", "/api/sync/push", httpCookie, [sameRevisionA], httpSession.csrfToken),
    fetchSync("POST", "/api/sync/push", deviceBCookie, [sameRevisionB], deviceBSession.csrfToken),
  ]);
  const results = [raceA.body.results[0], raceB.body.results[0]];
  must(
    results.filter((x) => x?.kind === "ok").length === 1 &&
      results.filter((x) => x?.kind === "conflict").length === 1,
    "Concurrent device edits silently overwrote each other",
  );
  must(
    results.find((x) => x.kind === "conflict").current?.revision === 2,
    "Conflict response omitted current authoritative revision",
  );
  console.log("G5_TWO_CLIENT_RACING_EDITS_AND_CONFLICT=PASS");

  // Four concurrent valid create transactions must serialize, not allocate
  // independent sequence numbers that could commit in reverse order.
  const concurrent = Array.from({ length: 4 }, (_, i) => ({
    clientMutationId: randomUUID(),
    type: "create",
    taskId: randomUUID(),
    input: { title: "Concurrent sync task " + i },
  }));
  const simultaneous = await Promise.all(
    concurrent.map((op, i) =>
      fetchSync(
        "POST",
        "/api/sync/push",
        i % 2 ? deviceBCookie : httpCookie,
        [op],
        i % 2 ? deviceBSession.csrfToken : httpSession.csrfToken,
      ),
    ),
  );
  must(
    simultaneous.every((item) => item.status === 200 && item.body.results[0].kind === "ok"),
    "Concurrent independent creates failed",
  );
  const cursors = await database.query(
    "select cursor from change_log where user_id=$1 order by cursor",
    [owner],
  );
  const seq = cursors.rows.map((row) => Number(row.cursor));
  must(
    seq.every((n, i) => n === i + 1) && seq.at(-1) === cursorBefore + 6,
    "Missing/duplicated or out-of-order per-owner cursor",
  );
  const current = await database.query("select revision from tasks where id=$1", [syncedId]);
  must(current.rows[0]?.revision === 2, "Unexpected revision after racing edit");
  const deletion = await fetchSync(
    "POST",
    "/api/sync/push",
    httpCookie,
    [
      {
        clientMutationId: randomUUID(),
        type: "delete",
        taskId: syncedId,
        expectedRevision: 2,
      },
    ],
    httpSession.csrfToken,
  );
  must(deletion.body.results[0]?.kind === "ok", "Sync deletion failed");
  const sinceCreate = await fetchSync("GET", "/api/sync/pull?cursor=" + firstCursor, deviceBCookie);
  must(
    sinceCreate.body.changes.some(
      (entry) =>
        entry.operation === "delete" && entry.entityId === syncedId && !!entry.payload.deletedAt,
    ),
    "Device B did not receive tombstone",
  );
  const afterDelete = await fetchSync("GET", "/api/sync/bootstrap", deviceBCookie);
  must(
    !afterDelete.body.tasks.some((task) => task.id === syncedId),
    "Bootstrap leaked deleted task",
  );
  const ahead = await fetchSync("GET", "/api/sync/pull?cursor=999999", deviceBCookie);
  must(
    ahead.status === 409 && ahead.body.action === "bootstrap",
    "Future/invalid cursor not rejected",
  );
  console.log("G5_COMMIT_SAFE_CURSOR_TOMBSTONE_AND_BOOTSTRAP=PASS");

  // Negative API contracts: CSRF, Origin, unknown fields and foreign owner.
  const denied = await fetchSync(
    "POST",
    "/api/sync/push",
    httpCookie,
    [
      {
        clientMutationId: randomUUID(),
        type: "create",
        taskId: randomUUID(),
        input: { title: "Forged" },
      },
    ],
    "incorrect-csrf",
  );
  must(denied.status === 403, "Sync push accepted bad CSRF");
  const malformed = await fetch(httpAddress + "/api/sync/push", {
    method: "POST",
    headers: deviceHeaders(httpCookie, httpSession.csrfToken),
    body: JSON.stringify({
      operations: [
        {
          clientMutationId: randomUUID(),
          type: "create",
          taskId: randomUUID(),
          input: { title: "Injected", userId: secondaryId },
        },
      ],
    }),
  });
  must(malformed.status === 400, "Sync accepted client-assigned userId");
  const foreignSync = await fetchSync(
    "POST",
    "/api/sync/push",
    httpCookie,
    [
      {
        clientMutationId: randomUUID(),
        type: "update",
        taskId: foreignId,
        expectedRevision: 1,
        patch: { title: "Not yours" },
      },
    ],
    httpSession.csrfToken,
  );
  must(foreignSync.body.results[0]?.kind === "not-found", "Sync pushed foreign owner mutation");
  // Verify a distinct owner has no visibility even for a populated owner feed.
  await database.query(
    "update users set password_hash=(select password_hash from users where id=$1) where id=$2",
    [owner, secondaryId],
  );
  const foreignLogin = await fetch(httpAddress + "/api/auth/login", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:5173", "content-type": "application/json" },
    body: JSON.stringify({ email: "other.g3@example.test", password: ownerPass }),
  });
  must(foreignLogin.status === 200, "Other test owner login failed");
  const foreignCookie = String(foreignLogin.headers.get("set-cookie")).split(";")[0];
  const foreignBootstrap = await fetchSync("GET", "/api/sync/bootstrap", foreignCookie);
  const foreignPull = await fetchSync("GET", "/api/sync/pull?cursor=0", foreignCookie);
  must(
    foreignBootstrap.status === 200 &&
      foreignPull.status === 200 &&
      !foreignBootstrap.body.tasks.some((task) => task.id === syncedId) &&
      foreignPull.body.changes.length === 0,
    "Sync change feed leaked data between owners",
  );
  console.log("G5_CSRF_INPUT_OWNER_SCOPE=PASS");
  console.log("G5_REAL_POSTGRES_TWO_DEVICE_SYNC_RESULT=PASS");

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
      tasks.json().tasks.some((task) => task.title === "owner task") &&
      !tasks.json().tasks.some((task) => task.title === "different owner task"),
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
