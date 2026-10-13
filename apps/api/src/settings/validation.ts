import { z } from "zod";

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const theme = z.enum(["system", "light", "dark"]);

function validTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const fields = {
  timeZone: z.string().min(1).max(80).refine(validTimeZone, "Invalid time zone"),
  workingDays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .refine((days) => new Set(days).size === days.length, "Duplicate weekday"),
  workingDayStart: hm,
  workingDayEnd: hm,
  defaultTaskDurationMinutes: z.number().int().min(1).max(1440),
  bufferMinutes: z.number().int().min(0).max(1440),
  weekStartsOn: z.number().int().min(0).max(6),
  theme,
};

export const updateSettingsSchema = z
  .object({
    ...fields,
    timeZone: fields.timeZone.optional(),
    workingDays: fields.workingDays.optional(),
    workingDayStart: fields.workingDayStart.optional(),
    workingDayEnd: fields.workingDayEnd.optional(),
    defaultTaskDurationMinutes: fields.defaultTaskDurationMinutes.optional(),
    bufferMinutes: fields.bufferMinutes.optional(),
    weekStartsOn: fields.weekStartsOn.optional(),
    theme: fields.theme.optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "expectedRevision"), "No changes")
  .refine((value) => {
    if (!value.workingDayStart || !value.workingDayEnd) return true;
    return value.workingDayStart < value.workingDayEnd;
  }, "Working hours must end after they start");
