export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function addDays(date: string, days: number): string {
  const next = new Date(date + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function weekStart(date: string, weekStartsOn: number): string {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return addDays(date, -((day - weekStartsOn + 7) % 7));
}

export function shiftMonth(date: string, delta: number): string {
  const [year, month] = date.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 10);
}

export function monthCells(anchor: string, weekStartsOn: number): string[] {
  const [year, month] = anchor.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const start = weekStart(first, weekStartsOn);
  const cells = [start];
  let cursor = start;
  while (cursor < last || cells.length % 7 !== 0) {
    cursor = addDays(cursor, 1);
    cells.push(cursor);
  }
  return cells;
}

export function wallClockToInput(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
