import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createTaskSchema, updateTaskSchema, deleteTaskSchema, idSchema } from "./validation.js";
import type { TaskStore } from "./types.js";

export interface TaskRouteAuth {
  owner: (request: FastifyRequest) => Promise<string | null>;
  canMutate: (request: FastifyRequest) => Promise<boolean>;
}

export function registerTaskRoutes(app: FastifyInstance, store: TaskStore, auth: TaskRouteAuth) {
  async function requireOwner(request: FastifyRequest, reply: FastifyReply, mutate = false) {
    const ownerId = await auth.owner(request);
    if (!ownerId) {
      reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    if (mutate && !(await auth.canMutate(request))) {
      reply.code(403).send({ error: "invalid-origin-or-csrf" });
      return null;
    }
    reply.header("Cache-Control", "no-store");
    return ownerId;
  }

  app.get("/api/tasks", async (request, reply) => {
    const owner = await requireOwner(request, reply);
    if (!owner) return reply;
    return { tasks: await store.listTasks(owner) };
  });

  app.post("/api/tasks", async (request, reply) => {
    const owner = await requireOwner(request, reply, true);
    if (!owner) return reply;
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid-task" });
    const task = await store.createTask(owner, parsed.data);
    return reply.code(201).send({ task });
  });

  app.patch("/api/tasks/:id", async (request, reply) => {
    const owner = await requireOwner(request, reply, true);
    if (!owner) return reply;
    const id = idSchema.safeParse((request.params as { id: string }).id);
    const parsed = updateTaskSchema.safeParse(request.body);
    if (!id.success || !parsed.success) return reply.code(400).send({ error: "invalid-task" });
    const { expectedRevision, ...patch } = parsed.data;
    const result = await store.updateTask(owner, id.data, expectedRevision, patch);
    if (result.kind === "not-found") return reply.code(404).send({ error: "not-found" });
    if (result.kind === "conflict") return reply.code(409).send({ error: "revision-conflict" });
    if (result.kind === "overlap") return reply.code(409).send({ error: "schedule-overlap" });
    return { task: result.task };
  });

  app.delete("/api/tasks/:id", async (request, reply) => {
    const owner = await requireOwner(request, reply, true);
    if (!owner) return reply;
    const id = idSchema.safeParse((request.params as { id: string }).id);
    const parsed = deleteTaskSchema.safeParse(request.body);
    if (!id.success || !parsed.success) return reply.code(400).send({ error: "invalid-task" });
    const result = await store.deleteTask(owner, id.data, parsed.data.expectedRevision);
    if (result.kind === "not-found") return reply.code(404).send({ error: "not-found" });
    if (result.kind !== "ok") return reply.code(409).send({ error: "revision-conflict" });
    return { deleted: true, revision: result.task.revision };
  });
}
