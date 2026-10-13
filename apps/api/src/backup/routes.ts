import { MAX_BACKUP_BYTES, parseBackup } from "@dayflow/domain";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { TaskRouteAuth } from "../tasks/routes.js";
import type { BackupStore } from "./types.js";

export function registerBackupRoutes(
  app: FastifyInstance,
  store: BackupStore,
  auth: TaskRouteAuth,
) {
  app.post("/api/backup/import", { bodyLimit: MAX_BACKUP_BYTES }, async (request, reply) => {
    const owner = await requireOwner(request, reply, auth);
    if (!owner) return reply;
    const text = JSON.stringify(request.body ?? null);
    const parsed = parseBackup(text);
    if (!parsed.ok) return reply.code(400).send({ error: "invalid-backup", errors: parsed.errors });
    const result = await store.importTasks(owner, parsed.backup.tasks, parsed.backup.settings);
    if (result.kind === "overlap") return reply.code(409).send({ error: "schedule-overlap" });
    return { imported: result.imported, skipped: result.skipped };
  });
}

async function requireOwner(request: FastifyRequest, reply: FastifyReply, auth: TaskRouteAuth) {
  const ownerId = await auth.owner(request);
  if (!ownerId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  if (!(await auth.canMutate(request))) {
    reply.code(403).send({ error: "invalid-origin-or-csrf" });
    return null;
  }
  reply.header("Cache-Control", "no-store");
  return ownerId;
}
