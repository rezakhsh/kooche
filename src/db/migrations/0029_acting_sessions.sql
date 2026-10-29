-- Sign in as a user (wave 2 part 1, docs/setup.md, "Sign in as a user"): a session an admin opened
-- for someone, why, and since when changes are allowed (null: read only).
ALTER TABLE "sessions" ADD COLUMN "opened_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "opened_reason" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "writable_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_opened_check" CHECK ("sessions"."opened_by_user_id" IS NOT NULL OR ("sessions"."opened_reason" IS NULL AND "sessions"."writable_at" IS NULL));