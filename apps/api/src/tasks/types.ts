export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: "inbox" | "scheduled" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  estimatedMinutes: number | null;
  tags: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  priority?: TaskView["priority"];
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  tags?: string[];
}

export type TaskPatch = Partial<TaskCreate> & { status?: "inbox" | "completed" };

export type ChangeResult =
  { kind: "ok"; task: TaskView } | { kind: "not-found" } | { kind: "conflict" };

export interface TaskStore {
  listTasks(userId: string): Promise<TaskView[]>;
  createTask(userId: string, input: TaskCreate): Promise<TaskView>;
  updateTask(userId: string, id: string, revision: number, patch: TaskPatch): Promise<ChangeResult>;
  deleteTask(userId: string, id: string, revision: number): Promise<ChangeResult>;
}
