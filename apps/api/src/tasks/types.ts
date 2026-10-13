export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: "inbox" | "scheduled" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  estimatedMinutes: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  tags: string[];
  subtasks: Subtask[];
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
  subtasks?: Subtask[];
}

export type TaskPatch = Partial<TaskCreate> & {
  status?: "inbox" | "completed";
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
};

export type ChangeResult =
  | { kind: "ok"; task: TaskView }
  | { kind: "not-found" }
  | { kind: "conflict" }
  | { kind: "overlap" };

export interface TaskStore {
  listTasks(userId: string): Promise<TaskView[]>;
  createTask(userId: string, input: TaskCreate): Promise<TaskView>;
  updateTask(userId: string, id: string, revision: number, patch: TaskPatch): Promise<ChangeResult>;
  deleteTask(userId: string, id: string, revision: number): Promise<ChangeResult>;
}
