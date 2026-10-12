CREATE TABLE "change_log" (
	"user_id" uuid NOT NULL,
	"cursor" bigint NOT NULL,
	"entity_id" uuid NOT NULL,
	"operation" varchar(8) NOT NULL,
	"revision" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_log_user_id_cursor_pk" PRIMARY KEY("user_id","cursor"),
	CONSTRAINT "change_log_operation_check" CHECK ("change_log"."operation" in ('create','update','delete')),
	CONSTRAINT "change_log_cursor_check" CHECK ("change_log"."cursor" > 0)
);
--> statement-breakpoint
CREATE TABLE "processed_mutations" (
	"user_id" uuid NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_mutations_user_id_client_mutation_id_pk" PRIMARY KEY("user_id","client_mutation_id")
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_cursor" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_mutations" ADD CONSTRAINT "processed_mutations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_log_user_entity_idx" ON "change_log" USING btree ("user_id","entity_id");--> statement-breakpoint
CREATE INDEX "processed_mutations_created_idx" ON "processed_mutations" USING btree ("created_at");