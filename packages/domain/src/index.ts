export type TaskStatus = "inbox" | "scheduled" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string; // Calendar-only YYYY-MM-DD, never a UTC instant.
  scheduledStart?: string; // UTC ISO 8601 instant.
  scheduledEnd?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export function normalizeTaskTitle(rawTitle: string): string {
  return rawTitle.trim().replace(/\s+/g, " ");
}

export function validateTaskTitle(rawTitle: string): string {
  const title = normalizeTaskTitle(rawTitle);
  if (!title) throw new Error("Tiêu đề công việc không được để trống");
  if (title.length > 240) throw new Error("Tiêu đề quá dài (tối đa 240 ký tự)");
  return title;
}
