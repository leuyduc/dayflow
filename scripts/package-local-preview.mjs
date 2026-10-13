/**
 * Build a SAFE, transferable DayFlow Windows local-review source/bundle ZIP.
 * Explicit whitelist: never package .git, node_modules, ignored .artifacts,
 * local DB, generated credentials, SSH secrets, .env, or production config.
 *
 * Usage: npm run demo:package
 * Output: .artifacts/releases/DayFlow_V2_Local_Review_20261013.zip
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(repo, ".artifacts", "releases");
const name = "DayFlow_V2_Local_Review_20261013";
const archive = path.join(releaseDir, name + ".zip");
const stage = path.join(releaseDir, ".staging-" + randomBytes(5).toString("hex"));
const files = [
  ".gitignore",
  ".prettierrc.json",
  "eslint.config.js",
  "LICENSE",
  "package-lock.json",
  "package.json",
  "START_DAYFLOW_LOCAL.bat",
  "tsconfig.base.json",
  "vitest.config.ts",
];
const dirs = ["apps", "packages", "scripts"];
const docs = [
  "docs/DAYFLOW_LOCAL_PREVIEW.md",
  "docs/V2_ACTIVE_MASTER_PLAN_20261013.md",
  "docs/V2_G6_G8_LOCAL_E2E_20261013.md",
  "docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md",
];
const excluded = new Set([
  "node_modules",
  ".git",
  ".artifacts",
  ".env",
  "test-results",
  "coverage",
]);

function allowed(source) {
  const relative = path.relative(repo, source);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  const pieces = relative.split(path.sep);
  if (pieces.some((part) => excluded.has(part))) return false;
  const basename = path.basename(source).toLowerCase();
  if (
    basename.startsWith(".env.") ||
    basename.endsWith(".local") ||
    basename.endsWith(".log") ||
    basename.includes("secret") ||
    basename.includes("credential") ||
    basename === "login-local-only.txt"
  )
    return false;
  return true;
}

function createAndValidateZip(staged, target) {
  const result = spawnSync(
    "python",
    [path.join(repo, "scripts", "create-local-review-archive.py"), staged, target],
    { encoding: "utf8", windowsHide: true, timeout: 180_000 },
  );
  if (result.status !== 0) {
    throw new Error(
      "Cross-platform archive failed: " + String(result.stderr || result.stdout).slice(0, 350),
    );
  }
  return result.stdout.trim();
}

if (process.platform !== "win32")
  throw new Error("Portable packaging requires Windows with Python 3 installed");
if (!existsSync(path.join(repo, "apps", "web", "dist", "index.html")))
  throw new Error("Build DayFlow first: npm run build");
await mkdir(releaseDir, { recursive: true });
await mkdir(stage, { recursive: false });

try {
  for (const filename of files) {
    const source = path.join(repo, filename);
    if (!existsSync(source)) throw new Error("Missing source file: " + filename);
    await cp(source, path.join(stage, filename), { recursive: false });
  }
  for (const dirname of dirs) {
    const source = path.join(repo, dirname);
    if (!existsSync(source)) throw new Error("Missing source directory: " + dirname);
    await cp(source, path.join(stage, dirname), {
      recursive: true,
      filter: allowed,
      force: false,
    });
  }
  for (const filename of docs) {
    const source = path.join(repo, filename);
    if (!existsSync(source)) throw new Error("Missing review documentation: " + filename);
    await mkdir(path.dirname(path.join(stage, filename)), { recursive: true });
    await cp(source, path.join(stage, filename));
  }
  await writeFile(
    path.join(stage, "OPEN_THIS_FIRST.txt"),
    [
      "DAYFLOW V2 - Windows Local Review (NOT PRODUCTION)",
      "",
      "1. Extract all ZIP files into a new Windows folder.",
      "2. Double-click START_DAYFLOW_LOCAL.bat. Node.js 22.12+ and npm are required.",
      "3. Open http://127.0.0.1:5180, if the browser does not open itself.",
      "4. The first run generates local test credentials in:",
      "   .artifacts\\dayflow-local-preview\\LOGIN-LOCAL-ONLY.txt",
      "5. Keep the CMD window open while using the app. Press Ctrl+C to stop.",
      "",
      "For Vietnamese instructions see docs\\DAYFLOW_LOCAL_PREVIEW.md.",
      "This ZIP contains no credentials, user database or node_modules.",
      "The launcher installs dependencies only on the local Windows machine.",
      "",
    ].join("\r\n"),
  );
  // ZIP entry paths must use POSIX slashes so Linux can extract them.
  console.log(createAndValidateZip(stage, archive));
  const first = await readFile(path.join(stage, "OPEN_THIS_FIRST.txt"), "utf8");
  if (!first.includes("NOT PRODUCTION")) throw new Error("Review README incomplete");
  console.log("DAYFLOW_LOCAL_REVIEW_PACKAGE_CREATED=PASS");
  console.log("Archive: " + archive);
} finally {
  // Only delete the unique, generated staging folder of this invocation.
  await rm(stage, { recursive: true, force: true });
}
