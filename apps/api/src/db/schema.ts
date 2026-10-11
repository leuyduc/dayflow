import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expiry_idx").on(table.expiresAt),
  ],
);

export type SubtaskValue = { id: string; title: string; completed: boolean };

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 12 }).notNull().default("inbox"),
    priority: varchar("priority", { length: 8 }).notNull().default("medium"),
    dueDate: date("due_date", { mode: "string" }),
    estimatedMinutes: integer("estimated_minutes"),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    subtasks: jsonb("subtasks").$type<SubtaskValue[]>().notNull().default([]),
    revision: integer("revision").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("tasks_user_status_idx").on(table.userId, table.status),
    index("tasks_user_updated_idx").on(table.userId, table.updatedAt),
    index("tasks_user_schedule_idx").on(table.userId, table.scheduledStart),
    check("task_status_check", sql`${table.status} in ('inbox','scheduled','completed')`),
    check("task_priority_check", sql`${table.priority} in ('low','medium','high','urgent')`),
    check("task_title_not_blank_check", sql`length(trim(${table.title})) > 0`),
    check("task_revision_check", sql`${table.revision} > 0`),
    check(
      "task_estimated_minutes_check",
      sql`${table.estimatedMinutes} is null or ${table.estimatedMinutes} between 1 and 1440`,
    ),
    check(
      "task_scheduled_range_check",
      sql`(${table.scheduledStart} is null and ${table.scheduledEnd} is null) or (${table.scheduledStart} is not null and ${table.scheduledEnd} > ${table.scheduledStart})`,
    ),
    check(
      "task_scheduled_status_check",
      sql`${table.status} <> 'scheduled' or ${table.scheduledStart} is not null`,
    ),
  ],
);

export const settings = pgTable(
  "settings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    timeZone: varchar("time_zone", { length: 80 }).notNull().default("Asia/Ho_Chi_Minh"),
    workingDays: jsonb("working_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
    workingDayStart: varchar("working_day_start", { length: 5 }).notNull().default("09:00"),
    workingDayEnd: varchar("working_day_end", { length: 5 }).notNull().default("17:00"),
    defaultTaskDurationMinutes: integer("default_task_duration_minutes").notNull().default(30),
    bufferMinutes: integer("buffer_minutes").notNull().default(10),
    weekStartsOn: integer("week_starts_on").notNull().default(1),
    theme: varchar("theme", { length: 8 }).notNull().default("system"),
    revision: integer("revision").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("settings_duration_check", sql`${table.defaultTaskDurationMinutes} between 1 and 1440`),
    check("settings_buffer_check", sql`${table.bufferMinutes} between 0 and 1440`),
    check("settings_week_start_check", sql`${table.weekStartsOn} between 0 and 6`),
    check("settings_revision_check", sql`${table.revision} > 0`),
  ],
);
