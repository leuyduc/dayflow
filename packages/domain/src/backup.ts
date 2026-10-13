export const BACKUP_FORMAT = "dayflow-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const MAX_BACKUP_TASKS = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = ["inbox", "scheduled", "completed"];

export interface BackupTask {
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
  subtasks: Array<{ id: string; title: string; completed: boolean }>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface BackupSettings {
  timeZone: string;
  workingDays: number[];
  workingDayStart: string;
  workingDayEnd: string;
  defaultTaskDurationMinutes: number;
  bufferMinutes: number;
  // Optional for backwards compatibility with older DayFlow backup v1 files.
  weekStartsOn?: number;
  theme?: "system" | "light" | "dark";
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  tasks: BackupTask[];
  settings: BackupSettings;
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; errors: string[] };

export interface OccupiedInterval {
  start: string;
  end: string;
}

export type ImportPlan =
  { ok: true; insert: BackupTask[]; skipped: number } | { ok: false; error: "schedule-overlap" };

function intervalsOverlap(start: string, end: string, other: OccupiedInterval): boolean {
  return Date.parse(start) < Date.parse(other.end) && Date.parse(end) > Date.parse(other.start);
}

/**
 * Decides an all-or-nothing import. Existing IDs are skipped.
 * Any overlap with occupied time, or between new blocks, rejects the whole file.
 */
export function planBackupImport(
  existingIds: ReadonlySet<string>,
  occupied: readonly OccupiedInterval[],
  incoming: readonly BackupTask[],
): ImportPlan {
  const insert: BackupTask[] = [];
  let skipped = 0;
  const blocks = occupied.map((interval) => ({ start: interval.start, end: interval.end }));
  for (const task of incoming) {
    if (existingIds.has(task.id)) {
      skipped += 1;
      continue;
    }
    if (task.scheduledStart && task.scheduledEnd) {
      const block = { start: task.scheduledStart, end: task.scheduledEnd };
      if (blocks.some((existing) => intervalsOverlap(block.start, block.end, existing))) {
        return { ok: false, error: "schedule-overlap" };
      }
      blocks.push(block);
    }
    insert.push(task);
  }
  return { ok: true, insert, skipped };
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function isInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    /T.*(Z|[+-]\d{2}:\d{2})$/.test(value)
  );
}
function isNullableString(value: unknown, max: number): value is string | null {
  return value === null || (typeof value === "string" && value.length <= max);
}

function checkTask(raw: unknown, index: number, errors: string[]): BackupTask | null {
  const at = `tasks[${index}]`;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    errors.push(`${at}: phải là một object.`);
    return null;
  }
  const t = raw as Record<string, unknown>;
  const before = errors.length;
  if (typeof t.id !== "string" || !UUID.test(t.id))
    errors.push(`${at}.id: không phải UUID hợp lệ.`);
  const title = typeof t.title === "string" ? t.title.trim().replace(/\s+/g, " ") : "";
  if (!title || title.length > 240) errors.push(`${at}.title: phải có 1–240 ký tự.`);
  if (!STATUSES.includes(t.status as string)) errors.push(`${at}.status: không hợp lệ.`);
  if (!PRIORITIES.includes(t.priority as string)) errors.push(`${at}.priority: không hợp lệ.`);
  if (!isNullableString(t.description, 5000)) errors.push(`${at}.description: tối đa 5000 ký tự.`);
  if (t.dueDate !== null && !isDateOnly(t.dueDate))
    errors.push(`${at}.dueDate: phải là YYYY-MM-DD.`);
  if (
    t.estimatedMinutes !== null &&
    !(
      Number.isInteger(t.estimatedMinutes) &&
      (t.estimatedMinutes as number) >= 1 &&
      (t.estimatedMinutes as number) <= 1440
    )
  )
    errors.push(`${at}.estimatedMinutes: phải là số nguyên 1–1440 hoặc null.`);
  if (
    !Array.isArray(t.tags) ||
    t.tags.length > 12 ||
    t.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > 40)
  )
    errors.push(`${at}.tags: tối đa 12 thẻ, mỗi thẻ 1–40 ký tự.`);
  const subtasks = t.subtasks === undefined ? [] : t.subtasks;
  if (
    !Array.isArray(subtasks) ||
    subtasks.length > 30 ||
    subtasks.some(
      (item) =>
        typeof item !== "object" ||
        item === null ||
        typeof (item as { id?: unknown }).id !== "string" ||
        !UUID.test((item as { id: string }).id) ||
        typeof (item as { title?: unknown }).title !== "string" ||
        !(item as { title: string }).title.trim() ||
        (item as { title: string }).title.trim().length > 240 ||
        typeof (item as { completed?: unknown }).completed !== "boolean",
    ) ||
    new Set(subtasks.map((item) => (item as { id: string }).id)).size !== subtasks.length
  )
    errors.push(`${at}.subtasks: tối đa 30 việc con, mỗi việc cần id, tiêu đề và trạng thái.`);
  const hasStart = t.scheduledStart !== null && t.scheduledStart !== undefined;
  const hasEnd = t.scheduledEnd !== null && t.scheduledEnd !== undefined;
  if (hasStart !== hasEnd) errors.push(`${at}: lịch phải có cả giờ bắt đầu và kết thúc.`);
  if (hasStart && hasEnd) {
    if (!isInstant(t.scheduledStart) || !isInstant(t.scheduledEnd))
      errors.push(`${at}: thời gian lịch không hợp lệ.`);
    else if (Date.parse(t.scheduledEnd as string) <= Date.parse(t.scheduledStart as string))
      errors.push(`${at}: giờ kết thúc phải sau giờ bắt đầu.`);
  }
  if (t.status === "scheduled" && !hasStart)
    errors.push(`${at}: trạng thái đã lịch nhưng thiếu khối lịch.`);
  if (!isInstant(t.createdAt) || !isInstant(t.updatedAt))
    errors.push(`${at}: createdAt/updatedAt không hợp lệ.`);
  if (t.completedAt !== null && !isInstant(t.completedAt))
    errors.push(`${at}.completedAt: không hợp lệ.`);
  if (errors.length > before) return null;
  return {
    id: t.id as string,
    title,
    description: (t.description as string | null) ?? null,
    status: t.status as BackupTask["status"],
    priority: t.priority as BackupTask["priority"],
    dueDate: (t.dueDate as string | null) ?? null,
    estimatedMinutes: (t.estimatedMinutes as number | null) ?? null,
    scheduledStart: hasStart ? (t.scheduledStart as string) : null,
    scheduledEnd: hasEnd ? (t.scheduledEnd as string) : null,
    tags: (t.tags as string[]).map((tag) => tag.trim()),
    subtasks: (subtasks as Array<{ id: string; title: string; completed: boolean }>).map(
      (item) => ({
        id: item.id,
        title: item.title.trim().replace(/\s+/g, " "),
        completed: item.completed,
      }),
    ),
    createdAt: t.createdAt as string,
    updatedAt: t.updatedAt as string,
    completedAt: (t.completedAt as string | null) ?? null,
  };
}

function validTimeZone(value: string): boolean {
  if (value.length === 0 || value.length > 80) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function checkSettings(raw: unknown, errors: string[]): BackupSettings | null {
  const s = raw as Record<string, unknown> | null;
  if (typeof s !== "object" || s === null) {
    errors.push("settings: phải là một object.");
    return null;
  }
  const ok =
    typeof s.timeZone === "string" &&
    validTimeZone(s.timeZone) &&
    Array.isArray(s.workingDays) &&
    s.workingDays.length > 0 &&
    new Set(s.workingDays).size === s.workingDays.length &&
    s.workingDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    typeof s.workingDayStart === "string" &&
    HM.test(s.workingDayStart) &&
    typeof s.workingDayEnd === "string" &&
    HM.test(s.workingDayEnd) &&
    s.workingDayStart < s.workingDayEnd &&
    Number.isInteger(s.defaultTaskDurationMinutes) &&
    (s.defaultTaskDurationMinutes as number) >= 1 &&
    (s.defaultTaskDurationMinutes as number) <= 1440 &&
    Number.isInteger(s.bufferMinutes) &&
    (s.bufferMinutes as number) >= 0 &&
    (s.bufferMinutes as number) <= 1440 &&
    (s.weekStartsOn === undefined ||
      (Number.isInteger(s.weekStartsOn) &&
        (s.weekStartsOn as number) >= 0 &&
        (s.weekStartsOn as number) <= 6)) &&
    (s.theme === undefined || s.theme === "system" || s.theme === "light" || s.theme === "dark");
  if (!ok) {
    errors.push("settings: giá trị cài đặt không hợp lệ.");
    return null;
  }
  return s as unknown as BackupSettings;
}

/**
 * Validates the whole backup before anything is written. Pure: no I/O, no clock.
 * Unknown top-level keys are ignored; unknown format or version is rejected.
 */
export function parseBackup(text: string): ParseResult {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    return { ok: false, errors: ["Tệp sao lưu quá lớn (tối đa 2 MB)."] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Tệp không phải JSON hợp lệ."] };
  }
  const root = data as Record<string, unknown> | null;
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return { ok: false, errors: ["Tệp sao lưu phải là một object JSON."] };
  }
  if (root.format !== BACKUP_FORMAT)
    return { ok: false, errors: ["Định dạng tệp không phải DayFlow."] };
  if (root.version !== BACKUP_VERSION) {
    return { ok: false, errors: [`Phiên bản sao lưu ${String(root.version)} chưa được hỗ trợ.`] };
  }
  if (!isInstant(root.exportedAt)) return { ok: false, errors: ["exportedAt không hợp lệ."] };
  if (!Array.isArray(root.tasks)) return { ok: false, errors: ["tasks phải là một danh sách."] };
  if (root.tasks.length > MAX_BACKUP_TASKS) {
    return { ok: false, errors: [`Tối đa ${MAX_BACKUP_TASKS} công việc trong một tệp.`] };
  }

  const errors: string[] = [];
  const tasks: BackupTask[] = [];
  const seen = new Set<string>();
  root.tasks.forEach((raw, index) => {
    const task = checkTask(raw, index, errors);
    if (!task) return;
    if (seen.has(task.id)) errors.push(`tasks[${index}].id: bị trùng trong tệp.`);
    seen.add(task.id);
    tasks.push(task);
  });
  const settings = checkSettings(root.settings, errors);
  if (errors.length > 0 || !settings) return { ok: false, errors: errors.slice(0, 20) };
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: root.exportedAt as string,
      tasks,
      settings,
    },
  };
}
