import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { TaskRouteAuth } from "../tasks/routes.js";
import type { SettingsStore } from "./types.js";
import { updateSettingsSchema } from "./validation.js";

export function registerSettingsRoutes(
  app: FastifyInstance,
  store: SettingsStore,
  auth: TaskRouteAuth,
) {
  app.get("/api/settings", async (request, reply) => {
    const owner = await requireOwner(request, reply, auth, false);
    if (!owner) return reply;
    return { settings: await store.getSettings(owner) };
  });

  app.patch("/api/settings", async (request, reply) => {
    const owner = await requireOwner(request, reply, auth, true);
    if (!owner) return reply;
    const parsed = updateSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid-settings" });
    const { expectedRevision, ...patch } = parsed.data;
    const result = await store.updateSettings(owner, expectedRevision, patch);
    if (result.kind === "invalid") return reply.code(400).send({ error: "invalid-settings" });
    if (result.kind === "conflict") {
      return reply.code(409).send({ error: "revision-conflict", settings: result.settings });
    }
    return { settings: result.settings };
  });
}

async function requireOwner(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: TaskRouteAuth,
  mutate: boolean,
) {
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
