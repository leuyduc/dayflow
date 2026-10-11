export interface OwnerRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
}

export interface AuthStore {
  getOwnerByEmail(email: string): Promise<OwnerRecord | null>;
  insertSession(record: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  getSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSessionByTokenHash(tokenHash: string): Promise<void>;
  listTasksForOwner(userId: string): Promise<TaskSummary[]>;
  checkReady?(): Promise<boolean>;
}
