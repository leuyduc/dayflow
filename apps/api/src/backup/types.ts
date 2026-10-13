import type { BackupSettings, BackupTask } from "@dayflow/domain";

export type ImportTasksResult =
  { kind: "ok"; imported: number; skipped: number } | { kind: "overlap" };

export interface BackupStore {
  importTasks(
    userId: string,
    tasks: readonly BackupTask[],
    settings: BackupSettings,
  ): Promise<ImportTasksResult>;
}
