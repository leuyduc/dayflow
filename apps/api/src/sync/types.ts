import type { TaskCreate, TaskPatch, TaskView } from "../tasks/types.js";

export type SyncMutation =
  | { clientMutationId: string; type: "create"; taskId: string; input: TaskCreate }
  | {
      clientMutationId: string;
      type: "update";
      taskId: string;
      expectedRevision: number;
      patch: TaskPatch;
    }
  | { clientMutationId: string; type: "delete"; taskId: string; expectedRevision: number };

export type SyncResult =
  | {
      clientMutationId: string;
      kind: "ok";
      cursor: number;
      task: TaskView | null;
      taskId: string;
      revision: number;
    }
  | { clientMutationId: string; kind: "conflict"; current: TaskView | null }
  | { clientMutationId: string; kind: "not-found" }
  | { clientMutationId: string; kind: "idempotency-key-reused" };

export interface SyncChange {
  cursor: number;
  entityId: string;
  operation: "create" | "update" | "delete";
  revision: number;
  payload: Record<string, unknown>;
}

export interface SyncStore {
  push(userId: string, operations: SyncMutation[]): Promise<SyncResult[]>;
  pull(
    userId: string,
    afterCursor: number,
    limit: number,
  ): Promise<{
    changes: SyncChange[];
    nextCursor: number;
    latestCursor: number;
    hasMore: boolean;
  }>;
  bootstrap(userId: string): Promise<{
    tasks: TaskView[];
    cursor: number;
  }>;
}
