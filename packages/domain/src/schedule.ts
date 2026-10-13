export type SchedulePriority = "low" | "medium" | "high" | "urgent";

export interface ScheduleSettings {
  timeZone: string;
  workingDays: number[]; // 0 = Sunday ... 6 = Saturday
  workingDayStart: string; // local HH:mm
  workingDayEnd: string; // local HH:mm
  defaultTaskDurationMinutes: number;
  bufferMinutes: number;
}

export interface SchedulableTask {
  id: string;
  status: "inbox" | "scheduled" | "completed";
  priority: SchedulePriority;
  dueDate: string | null; // YYYY-MM-DD, calendar date in the planning zone
  estimatedMinutes: number | null;
  createdAt: string;
}

export interface TimeBlock {
  start: string; // UTC ISO instant
  end: string; // UTC ISO instant
}

export interface SuggestInput {
  now: string; // UTC ISO instant, injected clock
  windowStartDate: string; // local YYYY-MM-DD, first planning day
  windowDays: number; // 1..31
  tasks: SchedulableTask[];
  obstacles: TimeBlock[];
  settings: ScheduleSettings;
}

export type UnscheduledReason = "no-working-time" | "duration-too-long" | "window-ended";

export interface Placement {
  taskId: string;
  start: string;
  end: string;
  warning?: "deadline-conflict";
}

export interface UnscheduledTask {
  taskId: string;
  reason: UnscheduledReason;
}

export interface SuggestResult {
  placements: Placement[];
  unscheduled: UnscheduledTask[];
}

const PRIORITY_RANK: Record<SchedulePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const MINUTE = 60_000;

function parseHm(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid HH:mm value: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid HH:mm value: ${value}`);
  return hours * 60 + minutes;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Converts a local wall-clock time in an IANA zone to a UTC instant (DST-aware). */
export function zonedWallClockToUtc(date: string, minutesOfDay: number, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d, Math.floor(minutesOfDay / 60), minutesOfDay % 60);
  const first = wall - zoneOffsetMs(wall, timeZone);
  return wall - zoneOffsetMs(first, timeZone);
}

function workingIntervals(input: SuggestInput): Array<[number, number]> {
  const { settings } = input;
  const startMinutes = parseHm(settings.workingDayStart);
  const endMinutes = parseHm(settings.workingDayEnd);
  if (endMinutes <= startMinutes) return [];
  const intervals: Array<[number, number]> = [];
  for (let offset = 0; offset < input.windowDays; offset++) {
    const date = addDays(input.windowStartDate, offset);
    if (!settings.workingDays.includes(weekdayOf(date))) continue;
    const start = zonedWallClockToUtc(date, startMinutes, settings.timeZone);
    const end = zonedWallClockToUtc(date, endMinutes, settings.timeZone);
    intervals.push([start, end]);
  }
  return intervals;
}

function subtract(free: Array<[number, number]>, busy: Array<[number, number]>) {
  let result = free;
  for (const [bStart, bEnd] of busy) {
    const next: Array<[number, number]> = [];
    for (const [start, end] of result) {
      if (bEnd <= start || bStart >= end) {
        next.push([start, end]);
        continue;
      }
      if (bStart > start) next.push([start, bStart]);
      if (bEnd < end) next.push([bEnd, end]);
    }
    result = next;
  }
  return result;
}

function compareTasks(a: SchedulableTask, b: SchedulableTask): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Pure, deterministic draft scheduler. Places each eligible task as one contiguous
 * block in the earliest free working slot, honouring obstacles, buffers and the clock.
 * Never mutates its input and never persists anything.
 */
export function suggestSchedule(input: SuggestInput): SuggestResult {
  const { settings } = input;
  const buffer = settings.bufferMinutes * MINUTE;
  const nowMs = Math.ceil(Date.parse(input.now) / MINUTE) * MINUTE;
  const eligible = input.tasks
    .filter((task) => task.status !== "completed")
    .slice()
    .sort(compareTasks);

  const working = workingIntervals(input)
    .map(([start, end]): [number, number] => [Math.max(start, nowMs), end])
    .filter(([start, end]) => end > start);
  const busy: Array<[number, number]> = input.obstacles.map((block) => [
    Date.parse(block.start) - buffer,
    Date.parse(block.end) + buffer,
  ]);

  const placements: Placement[] = [];
  const unscheduled: UnscheduledTask[] = [];

  for (const task of eligible) {
    const durationMs = (task.estimatedMinutes ?? settings.defaultTaskDurationMinutes) * MINUTE;
    if (working.length === 0) {
      unscheduled.push({ taskId: task.id, reason: "no-working-time" });
      continue;
    }
    const longest = Math.max(...working.map(([start, end]) => end - start));
    if (durationMs > longest) {
      unscheduled.push({ taskId: task.id, reason: "duration-too-long" });
      continue;
    }
    const free = subtract(working, busy);
    const deadlineEnd = task.dueDate
      ? zonedWallClockToUtc(addDays(task.dueDate, 1), 0, settings.timeZone)
      : null;
    const fits = (slot: [number, number]) => slot[1] - slot[0] >= durationMs;
    let slot = free.find(
      (candidate) =>
        fits(candidate) && (deadlineEnd === null || candidate[0] + durationMs <= deadlineEnd),
    );
    let warning: Placement["warning"];
    if (!slot) {
      slot = free.find(fits);
      if (slot && deadlineEnd !== null && slot[0] + durationMs > deadlineEnd)
        warning = "deadline-conflict";
    }
    if (!slot) {
      unscheduled.push({ taskId: task.id, reason: "window-ended" });
      continue;
    }
    const start = slot[0];
    const end = start + durationMs;
    placements.push({
      taskId: task.id,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      ...(warning ? { warning } : {}),
    });
    busy.push([start - buffer, end + buffer]);
  }

  return { placements, unscheduled };
}
