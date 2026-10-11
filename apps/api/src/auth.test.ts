import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Algorithm, hash } from "@node-rs/argon2";
import { buildApp } from "./app.js";
import type { AuthStore, OwnerRecord, SessionRecord, TaskSummary } from "./auth/types.js";

const ORIGIN = "http://127.0.0.1:5173";
const CSRF_SECRET = "test-only-32-character-auth-csrf-key-not-production";
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const password = "S3cure-Dev-Password!";

class MemoryStore implements AuthStore {
  owner: OwnerRecord | null = null;
  sessions = new Map<string, SessionRecord>();
  tasks: Array<TaskSummary & { userId: string }> = [];

  async getOwnerByEmail(email: string) {
    return email === this.owner?.email ? this.owner : null;
  }
  async insertSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.sessions.set(input.tokenHash, {
      ...input,
      email: this.owner?.email ?? "missing@example.test",
      revokedAt: null,
    });
  }
  async getSessionByTokenHash(hashValue: string) {
    return this.sessions.get(hashValue) ?? null;
  }
  async revokeSessionByTokenHash(hashValue: string) {
    const record = this.sessions.get(hashValue);
    if (record) record.revokedAt = new Date("2026-10-12T00:00:00Z");
  }
  async listTasksForOwner(userId: string) {
    return this.tasks
      .filter((item) => item.userId === userId)
      .map(({ userId: _userId, ...item }) => {
        void _userId;
        return item;
      });
  }
}

let passwordHash = "";
beforeAll(async () => {
  passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
});

const apps: ReturnType<typeof buildApp>[] = [];
function setup(time = new Date("2026-10-12T07:00:00Z")) {
  const store = new MemoryStore();
  store.owner = { id: ownerId, email: "owner@example.test", passwordHash };
  store.tasks = [
    {
      id: "a",
      title: "Owner task",
      priority: "high",
      status: "inbox",
      dueDate: null,
      userId: ownerId,
    },
    {
      id: "b",
      title: "Other user's task",
      priority: "low",
      status: "inbox",
      dueDate: null,
      userId: otherId,
    },
  ];
  const app = buildApp({
    auth: { store, csrfSecret: CSRF_SECRET, allowedOrigin: ORIGIN, now: () => time },
  });
  apps.push(app);
  return { app, store };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function login(
  app: ReturnType<typeof buildApp>,
  email = "owner@example.test",
  secret = password,
) {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: ORIGIN },
    payload: { email, password: secret },
  });
}

describe("owner authentication", () => {
  it("rejects anonymous me and task requests", async () => {
    const { app } = setup();
    expect((await app.inject("/api/auth/me")).statusCode).toBe(401);
    expect((await app.inject("/api/tasks")).statusCode).toBe(401);
  });

  it("rejects untrusted login Origin, invalid input and invalid password", async () => {
    const { app } = setup();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          headers: { origin: "https://evil.invalid" },
          payload: { email: "owner@example.test", password },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          headers: { origin: ORIGIN },
          payload: { email: "not-email", password: "short" },
        })
      ).statusCode,
    ).toBe(400);
    const wrong = await login(app, "owner@example.test", "WrongPassword!!!");
    expect(wrong.statusCode).toBe(401);
    expect(JSON.stringify(wrong.json())).not.toContain("passwordHash");
  });

  it("authenticates with Argon2id, sets HttpOnly cookie and isolates owner tasks", async () => {
    const { app, store } = setup();
    const response = await login(app, "OWNER@example.test");
    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Strict");
    expect(JSON.stringify(response.json())).not.toContain(passwordHash);
    expect([...store.sessions.keys()]).toHaveLength(1);
    expect([...store.sessions.keys()][0]).toMatch(/^[a-f0-9]{64}$/);

    const cookie = String(response.headers["set-cookie"]).split(";")[0];
    const me = await app.inject({ url: "/api/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user).toEqual({ id: ownerId, email: "owner@example.test" });
    expect(me.json().csrfToken).toMatch(/^[A-Za-z0-9_-]+$/);
    const tasks = await app.inject({ url: "/api/tasks", headers: { cookie } });
    expect(tasks.statusCode).toBe(200);
    expect(tasks.json().tasks).toEqual([
      { id: "a", title: "Owner task", priority: "high", status: "inbox", dueDate: null },
    ]);
  });

  it("rejects logout without valid CSRF and revokes the session after valid logout", async () => {
    const { app } = setup();
    const loggedIn = await login(app);
    const cookie = String(loggedIn.headers["set-cookie"]).split(";")[0];
    const csrfToken = loggedIn.json().csrfToken;
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { cookie, origin: ORIGIN },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { cookie, origin: "https://evil.invalid", "x-dayflow-csrf": csrfToken },
        })
      ).statusCode,
    ).toBe(403);
    const loggedOut = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie, origin: ORIGIN, "x-dayflow-csrf": csrfToken },
    });
    expect(loggedOut.statusCode).toBe(200);
    expect((await app.inject({ url: "/api/auth/me", headers: { cookie } })).statusCode).toBe(401);
  });

  it("rejects expired sessions", async () => {
    const { app, store } = setup();
    const response = await login(app);
    const cookie = String(response.headers["set-cookie"]).split(";")[0];
    for (const session of store.sessions.values())
      session.expiresAt = new Date("2020-01-01T00:00:00Z");
    expect((await app.inject({ url: "/api/auth/me", headers: { cookie } })).statusCode).toBe(401);
  });

  it("rate-limits repeated failed logins", async () => {
    const { app } = setup();
    const results = [];
    for (let i = 0; i < 6; i += 1)
      results.push((await login(app, "owner@example.test", "not-the-password")).statusCode);
    expect(results.at(-1)).toBe(429);
  });
});
