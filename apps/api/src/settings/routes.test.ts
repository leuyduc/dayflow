import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Algorithm, hash } from "@node-rs/argon2";
import { buildApp } from "../app.js";
import type { AuthStore, OwnerRecord, SessionRecord } from "../auth/types.js";
import type { PlannerSettings, SettingsPatch, SettingsStore } from "./types.js";

const origin = "http://127.0.0.1:5173";
const secret = "test-secret-for-settings-api-longer-than-32";
const ownerId = "11111111-1111-4111-8111-111111111111";
const password = "TestOnly-Auth-Safe-Password";
let passwordHash = "";

const defaults: PlannerSettings = {
  timeZone: "Asia/Ho_Chi_Minh",
  workingDays: [1, 2, 3, 4, 5],
  workingDayStart: "09:00",
  workingDayEnd: "17:00",
  defaultTaskDurationMinutes: 30,
  bufferMinutes: 10,
  weekStartsOn: 1,
  theme: "system",
  revision: 1,
};

class MemoryStore implements AuthStore, SettingsStore {
  sessions = new Map<string, SessionRecord>();
  settings: PlannerSettings = { ...defaults, workingDays: [...defaults.workingDays] };
  async getOwnerByEmail(email: string): Promise<OwnerRecord | null> {
    return email === "owner@example.test" ? { id: ownerId, email, passwordHash } : null;
  }
  async insertSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.sessions.set(input.tokenHash, { ...input, email: "owner@example.test", revokedAt: null });
  }
  async getSessionByTokenHash(hashValue: string) {
    return this.sessions.get(hashValue) ?? null;
  }
  async revokeSessionByTokenHash(hashValue: string) {
    const session = this.sessions.get(hashValue);
    if (session) session.revokedAt = new Date();
  }
  async listTasksForOwner() {
    return [];
  }
  async getSettings() {
    return { ...this.settings, workingDays: [...this.settings.workingDays] };
  }
  async updateSettings(_userId: string, revision: number, patch: SettingsPatch) {
    if (revision !== this.settings.revision) {
      return { kind: "conflict" as const, settings: await this.getSettings() };
    }
    const next = {
      ...this.settings,
      ...patch,
      workingDays: patch.workingDays ?? this.settings.workingDays,
    };
    if (next.workingDayStart >= next.workingDayEnd) return { kind: "invalid" as const };
    this.settings = { ...next, revision: revision + 1 };
    return { kind: "ok" as const, settings: await this.getSettings() };
  }
}

const apps: ReturnType<typeof buildApp>[] = [];
beforeAll(async () => {
  passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function authedApp() {
  const store = new MemoryStore();
  const app = buildApp({
    auth: { store, settings: store, csrfSecret: secret, allowedOrigin: origin },
  });
  apps.push(app);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin },
    payload: { email: "owner@example.test", password },
  });
  return {
    app,
    store,
    cookie: String(login.headers["set-cookie"]).split(";")[0] ?? "",
    csrf: login.json().csrfToken as string,
  };
}

describe("planner settings", () => {
  it("requires a session", async () => {
    const { app } = await authedApp();
    expect((await app.inject({ method: "GET", url: "/api/settings" })).statusCode).toBe(401);
  });

  it("reads defaults and saves a newer revision", async () => {
    const { app, cookie, csrf } = await authedApp();
    const first = await app.inject({ method: "GET", url: "/api/settings", headers: { cookie } });
    expect(first.statusCode).toBe(200);
    expect(first.json().settings).toMatchObject({ timeZone: "Asia/Ho_Chi_Minh", revision: 1 });
    const saved = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie, origin, "x-dayflow-csrf": csrf },
      payload: { expectedRevision: 1, bufferMinutes: 15, weekStartsOn: 0, theme: "dark" },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().settings).toMatchObject({
      bufferMinutes: 15,
      weekStartsOn: 0,
      theme: "dark",
      revision: 2,
    });
  });

  it("rejects a stale revision and an inverted workday", async () => {
    const { app, cookie, csrf } = await authedApp();
    const stale = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie, origin, "x-dayflow-csrf": csrf },
      payload: { expectedRevision: 4, bufferMinutes: 5 },
    });
    expect(stale.statusCode).toBe(409);
    const inverted = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie, origin, "x-dayflow-csrf": csrf },
      payload: { expectedRevision: 1, workingDayStart: "18:00", workingDayEnd: "09:00" },
    });
    expect(inverted.statusCode).toBe(400);
  });
});
