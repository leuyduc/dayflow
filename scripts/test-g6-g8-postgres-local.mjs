/**
 * G6/G8 browser + real PostgreSQL test harness for Windows development.
 *
 * Runs a throwaway PostgreSQL 17 sandbox on 127.0.0.1:55433 with runtime-only
 * credentials. It creates a disposable dayflow_test_* database and then invokes
 * the browser-to-API-to-PostgreSQL test. Never targets production or Linux.
 *
 * One-time local-only dependency:
 * npm install --prefix .artifacts/postgres-sandbox embedded-postgres@17.10.0-beta.17 --ignore-scripts --no-audit --no-fund
 */
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import net from "node:net";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = path.join(repo, ".artifacts", "postgres-sandbox");
const entry = path.join(sandbox, "node_modules", "embedded-postgres", "dist", "index.js");
const scenario = process.argv[2] ?? "g6g8";
if (!["g6g8", "g7"].includes(scenario)) throw new Error("Unknown local E2E scenario");
const label = scenario === "g7" ? "G7" : "G6G8";
const testScript = path.join(
  repo,
  "scripts",
  scenario === "g7" ? "browser-g7-e2e.mjs" : "browser-g6-g8-e2e.mjs",
);
const port = 55433;

if (!existsSync(entry)) {
  throw new Error(
    "Missing local embedded PostgreSQL. Install it only under .artifacts/postgres-sandbox using the command at the top of this file.",
  );
}
if (process.env.DAYFLOW_TEST_PG_EXTERNAL === "1") {
  throw new Error("This harness runs only its own isolated PostgreSQL sandbox.");
}

async function ensurePortFree() {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () =>
      reject(new Error("Loopback PostgreSQL test port already in use; no server was touched")),
    );
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
}

await ensurePortFree();
const { default: EmbeddedPostgres } = await import(pathToFileURL(entry).href);
const adminPassword = randomBytes(24).toString("hex");
const devPassword = randomBytes(24).toString("hex");
const dbName = "dayflow_test_" + scenario + "_" + randomBytes(4).toString("hex");
const databaseUrl = "postgres://dayflow_dev:" + devPassword + "@127.0.0.1:" + port + "/" + dbName;

const postgres = new EmbeddedPostgres({
  databaseDir: path.join(sandbox, scenario + "-integration-db"),
  user: "dayflow_sandbox",
  password: adminPassword,
  port,
  persistent: false,
  postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
  onLog: () => {},
});

let started = false;
let admin;
try {
  await postgres.initialise();
  await postgres.start();
  started = true;
  console.log(label + "_ISOLATED_LOCAL_POSTGRES_STARTED=PASS");

  admin = postgres.getPgClient();
  await admin.connect();
  // Runtime-generated hex-only credential and fixed role. Never log credentials.
  await admin.query("CREATE ROLE dayflow_dev LOGIN PASSWORD '" + devPassword + "'");
  await admin.query("CREATE DATABASE " + dbName + " OWNER dayflow_dev");
  await admin.end();
  admin = null;

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [testScript], {
      cwd: repo,
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DAYFLOW_DB_ENV: "development",
        NODE_ENV: "development",
      },
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error("Browser E2E terminated by signal " + signal));
      else resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) throw new Error(label + " browser E2E failed (exit " + exitCode + ")");
  console.log(label + "_EPHEMERAL_POSTGRES_BROWSER_RESULT=PASS");
} finally {
  if (admin) await admin.end().catch(() => {});
  if (started) {
    await postgres.stop();
    console.log(label + "_EPHEMERAL_POSTGRES_STOPPED=PASS");
  }
}
