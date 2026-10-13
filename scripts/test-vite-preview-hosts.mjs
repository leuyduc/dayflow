/**
 * Explicit Vite preview Host validation regression.
 * Tests the real preview server in a loopback-only ephemeral port without API or database.
 */
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repo, "apps", "web");

function requestWithHost(port, host) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/",
        method: "GET",
        headers: { Host: host },
        timeout: 5000,
      },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode));
      },
    );
    request.once("error", reject);
    request.once("timeout", () => request.destroy(new Error("Preview host test timed out")));
    request.end();
  });
}

const server = await preview({
  root: webRoot,
  configFile: path.join(webRoot, "vite.config.ts"),
  logLevel: "silent",
  preview: { host: "127.0.0.1", port: 0, strictPort: false },
});
try {
  const address = server.httpServer.address();
  assert(address && typeof address !== "string", "Preview did not bind TCP");
  assert.equal(address.address, "127.0.0.1", "Preview must bind only to loopback");

  const allowed = await requestWithHost(address.port, "dayflow.liuduc.site");
  const localhost = await requestWithHost(address.port, "127.0.0.1");
  const unwanted = await requestWithHost(address.port, "untrusted.liuduc.site");

  assert.equal(allowed, 200, "The exact DayFlow domain must be accepted");
  assert.equal(localhost, 200, "Loopback must remain available");
  assert.equal(unwanted, 403, "Other subdomains must remain blocked");

  console.log("DAYFLOW_VITE_PREVIEW_EXACT_HOST_ACCEPTED=PASS");
  console.log("DAYFLOW_VITE_PREVIEW_LOOPBACK_ACCEPTED=PASS");
  console.log("DAYFLOW_VITE_PREVIEW_OTHER_HOST_REJECTED=PASS");
} finally {
  await new Promise((resolve) => server.httpServer.close(resolve));
}
