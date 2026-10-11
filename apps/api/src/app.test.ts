import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];

function appForTest() {
  const app = buildApp();
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("DayFlow API foundation", () => {
  it("responds with a versioned health payload", async () => {
    const app = appForTest();
    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "ok",
      service: "dayflow-api",
      version: "0.1.0",
    });
  });

  it("does not expose an unimplemented task endpoint", async () => {
    const app = appForTest();
    const res = await app.inject({ method: "GET", url: "/api/tasks" });

    expect(res.statusCode).toBe(404);
  });

  it("does not accept an unsupported mutation to the health endpoint", async () => {
    const app = appForTest();
    const res = await app.inject({ method: "POST", url: "/api/health" });

    expect(res.statusCode).toBe(404);
  });
});
