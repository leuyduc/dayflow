import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { verify } from "@node-rs/argon2";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AuthStore, SessionRecord } from "./types.js";
import type { TaskStore } from "../tasks/types.js";
import { registerTaskRoutes } from "../tasks/routes.js";
import type { SyncStore } from "../sync/types.js";
import { registerSyncRoutes } from "../sync/routes.js";
import type { BackupStore } from "../backup/types.js";
import { registerBackupRoutes } from "../backup/routes.js";
import type { SettingsStore } from "../settings/types.js";
import { registerSettingsRoutes } from "../settings/routes.js";

const COOKIE = "dayflow_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 7;

const credentialsSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(8).max(1024),
  })
  .strict();

export interface AuthConfig {
  store: AuthStore;
  tasks?: TaskStore;
  sync?: SyncStore;
  backup?: BackupStore;
  settings?: SettingsStore;
  csrfSecret: string;
  allowedOrigin: string;
  cookieSecure?: boolean;
  now?: () => Date;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function csrfForTokenHash(secret: string, hash: string): string {
  return createHmac("sha256", secret).update(hash).digest("base64url");
}

function sameSecret(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string" || provided.length > 150) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function matchesOrigin(request: FastifyRequest, expected: string): boolean {
  return request.headers.origin === expected;
}

export async function registerAuth(app: FastifyInstance, options: AuthConfig): Promise<void> {
  if (Buffer.byteLength(options.csrfSecret) < 32) {
    throw new Error("DAYFLOW_CSRF_SECRET must be at least 32 bytes");
  }
  const now = options.now ?? (() => new Date());
  const cookieOptions = {
    httpOnly: true as const,
    secure: options.cookieSecure ?? false,
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_AGE_SECONDS,
  };

  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  async function readSession(request: FastifyRequest): Promise<{
    record: SessionRecord;
    hash: string;
  } | null> {
    const token = request.cookies[COOKIE];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const hash = tokenHash(token);
    const record = await options.store.getSessionByTokenHash(hash);
    if (!record || record.revokedAt || record.expiresAt.getTime() <= now().getTime()) {
      return null;
    }
    return { record, hash };
  }

  app.post(
    "/api/auth/login",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      if (!matchesOrigin(request, options.allowedOrigin)) {
        return reply.code(403).send({ error: "invalid-origin" });
      }
      const parsed = credentialsSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid-input" });

      const email = parsed.data.email.toLowerCase();
      const owner = await options.store.getOwnerByEmail(email);
      let accepted = false;
      if (owner) {
        try {
          accepted = await verify(owner.passwordHash, parsed.data.password);
        } catch {
          accepted = false;
        }
      }
      if (!owner || !accepted) {
        return reply.code(401).send({ error: "invalid-credentials" });
      }

      const token = randomBytes(32).toString("base64url");
      const hash = tokenHash(token);
      await options.store.insertSession({
        userId: owner.id,
        tokenHash: hash,
        expiresAt: new Date(now().getTime() + SESSION_AGE_SECONDS * 1000),
      });
      reply.setCookie(COOKIE, token, cookieOptions);
      reply.header("Cache-Control", "no-store");
      return {
        user: { id: owner.id, email: owner.email },
        csrfToken: csrfForTokenHash(options.csrfSecret, hash),
      };
    },
  );

  app.get("/api/auth/me", async (request, reply) => {
    const session = await readSession(request);
    reply.header("Cache-Control", "no-store");
    if (!session) return reply.code(401).send({ error: "unauthorized" });
    return {
      user: { id: session.record.userId, email: session.record.email },
      csrfToken: csrfForTokenHash(options.csrfSecret, session.hash),
    };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    if (!matchesOrigin(request, options.allowedOrigin)) {
      return reply.code(403).send({ error: "invalid-origin" });
    }
    const session = await readSession(request);
    if (!session) return reply.code(401).send({ error: "unauthorized" });
    const expected = csrfForTokenHash(options.csrfSecret, session.hash);
    if (!sameSecret(request.headers["x-dayflow-csrf"], expected)) {
      return reply.code(403).send({ error: "invalid-csrf" });
    }
    await options.store.revokeSessionByTokenHash(session.hash);
    reply.clearCookie(COOKIE, { path: "/" });
    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });

  const routeAuth = {
    owner: async (request: FastifyRequest) => (await readSession(request))?.record.userId ?? null,
    canMutate: async (request: FastifyRequest) => {
      if (!matchesOrigin(request, options.allowedOrigin)) return false;
      const session = await readSession(request);
      return (
        !!session &&
        sameSecret(
          request.headers["x-dayflow-csrf"],
          csrfForTokenHash(options.csrfSecret, session.hash),
        )
      );
    },
  };
  if (options.sync) registerSyncRoutes(app, options.sync, routeAuth);
  if (options.backup) registerBackupRoutes(app, options.backup, routeAuth);
  if (options.settings) registerSettingsRoutes(app, options.settings, routeAuth);
  if (options.tasks) {
    registerTaskRoutes(app, options.tasks, routeAuth);
  } else {
    // Retain the G3 read-only contract when the task store is not configured.
    app.get("/api/tasks", async (request, reply) => {
      const session = await readSession(request);
      if (!session) return reply.code(401).send({ error: "unauthorized" });
      reply.header("Cache-Control", "no-store");
      return { tasks: await options.store.listTasksForOwner(session.record.userId) };
    });
  }
}
