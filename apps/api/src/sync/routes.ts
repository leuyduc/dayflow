import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createTaskSchema, idSchema } from "../tasks/validation.js";
import type { TaskRouteAuth } from "../tasks/routes.js";
import type { SyncMutation, SyncStore } from "./types.js";

const cursor = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const create = z
  .object({
    clientMutationId: idSchema,
    type: z.literal("create"),
    taskId: idSchema,
    input: createTaskSchema,
  })
  .strict();
const update = z
  .object({
    clientMutationId: idSchema,
    type: z.literal("update"),
    taskId: idSchema,
    expectedRevision: z.number().int().positive(),
    patch: createTaskSchema
      .partial()
      .extend({ status: z.enum(["inbox", "completed"]).optional() })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, "empty patch"),
  })
  .strict();
const remove = z
  .object({
    clientMutationId: idSchema,
    type: z.literal("delete"),
    taskId: idSchema,
    expectedRevision: z.number().int().positive(),
  })
  .strict();
const batchSchema = z
  .object({
    operations: z
      .array(z.discriminatedUnion("type", [create, update, remove]))
      .min(1)
      .max(25),
  })
  .strict();

export function registerSyncRoutes(app: FastifyInstance, store: SyncStore, auth: TaskRouteAuth) {
  async function authorized(request: FastifyRequest, reply: FastifyReply, write: boolean) {
    const owner = await auth.owner(request);
    if (!owner) {
      reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    if (write && !(await auth.canMutate(request))) {
      reply.code(403).send({ error: "invalid-origin-or-csrf" });
      return null;
    }
    reply.header("Cache-Control", "no-store");
    return owner;
  }

  app.get("/api/sync/bootstrap", async (request, reply) => {
    const owner = await authorized(request, reply, false);
    if (!owner) return reply;
    return store.bootstrap(owner);
  });

  app.get("/api/sync/pull", async (request, reply) => {
    const owner = await authorized(request, reply, false);
    if (!owner) return reply;
    const parsed = z
      .object({
        cursor: cursor.default(0),
        limit: z.coerce.number().int().min(1).max(100).default(100),
      })
      .strict()
      .safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "invalid-cursor" });
    try {
      return await store.pull(owner, parsed.data.cursor, parsed.data.limit);
    } catch (error) {
      if (error instanceof Error && error.message === "sync-cursor-ahead") {
        return reply.code(409).send({ error: "cursor-ahead", action: "bootstrap" });
      }
      throw error;
    }
  });

  app.post("/api/sync/push", async (request, reply) => {
    const owner = await authorized(request, reply, true);
    if (!owner) return reply;
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid-mutations" });
    const result = await store.push(owner, parsed.data.operations as SyncMutation[]);
    // Operation errors are represented explicitly; no silent last-write-wins.
    return { results: result };
  });
}
