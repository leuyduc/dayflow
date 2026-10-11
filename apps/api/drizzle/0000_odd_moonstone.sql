CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"time_zone" varchar(80) DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"working_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb NOT NULL,
	"working_day_start" varchar(5) DEFAULT '09:00' NOT NULL,
	"working_day_end" varchar(5) DEFAULT '17:00' NOT NULL,
	"default_task_duration_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_minutes" integer DEFAULT 10 NOT NULL,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"theme" varchar(8) DEFAULT 'system' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_duration_check" CHECK ("settings"."default_task_duration_minutes" between 1 and 1440),
	CONSTRAINT "settings_buffer_check" CHECK ("settings"."buffer_minutes" between 0 and 1440),
	CONSTRAINT "settings_week_start_check" CHECK ("settings"."week_starts_on" between 0 and 6),
	CONSTRAINT "settings_revision_check" CHECK ("settings"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(240) NOT NULL,
	"description" text,
	"status" varchar(12) DEFAULT 'inbox' NOT NULL,
	"priority" varchar(8) DEFAULT 'medium' NOT NULL,
	"due_date" date,
	"estimated_minutes" integer,
	"scheduled_start" timestamp with time zone,
	"scheduled_end" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_status_check" CHECK ("tasks"."status" in ('inbox','scheduled','completed')),
	CONSTRAINT "task_priority_check" CHECK ("tasks"."priority" in ('low','medium','high','urgent')),
	CONSTRAINT "task_title_not_blank_check" CHECK (length(trim("tasks"."title")) > 0),
	CONSTRAINT "task_revision_check" CHECK ("tasks"."revision" > 0),
	CONSTRAINT "task_estimated_minutes_check" CHECK ("tasks"."estimated_minutes" is null or "tasks"."estimated_minutes" between 1 and 1440),
	CONSTRAINT "task_scheduled_range_check" CHECK (("tasks"."scheduled_start" is null and "tasks"."scheduled_end" is null) or ("tasks"."scheduled_start" is not null and "tasks"."scheduled_end" > "tasks"."scheduled_start")),
	CONSTRAINT "task_scheduled_status_check" CHECK ("tasks"."status" <> 'scheduled' or "tasks"."scheduled_start" is not null)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_user_updated_idx" ON "tasks" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "tasks_user_schedule_idx" ON "tasks" USING btree ("user_id","scheduled_start");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");