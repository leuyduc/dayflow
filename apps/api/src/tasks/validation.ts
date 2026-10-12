import { z } from "zod";

const validDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const dt = new Date(v + "T00:00:00.000Z");
    return !Number.isNaN(dt.valueOf()) && dt.toISOString().slice(0, 10) === v;
  }, "Invalid date-only value");

const priority = z.enum(["low", "medium", "high", "urgent"]);
const fields = {
  title: z.string().trim().min(1).max(240),
  description: z.string().max(5000).nullable(),
  priority,
  dueDate: validDate.nullable(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
};

export const createTaskSchema = z
  .object({
    title: fields.title,
    description: fields.description.optional(),
    priority: fields.priority.optional(),
    dueDate: fields.dueDate.optional(),
    estimatedMinutes: fields.estimatedMinutes.optional(),
    tags: fields.tags.optional(),
  })
  .strict();
export const updateTaskSchema = z
  .object({
    title: fields.title.optional(),
    description: fields.description.optional(),
    priority: fields.priority.optional(),
    dueDate: fields.dueDate.optional(),
    estimatedMinutes: fields.estimatedMinutes.optional(),
    tags: fields.tags.optional(),
    status: z.enum(["inbox", "completed"]).optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict()
  .refine((v) => Object.keys(v).some((k) => k !== "expectedRevision"), "No fields to update");

export const deleteTaskSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export const idSchema = z.uuid();
