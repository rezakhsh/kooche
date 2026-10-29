-- «احتمالاً کسب‌وکار» cases (wave 2 part 4, docs/setup.md, "Private or business"): the worker finds
-- them and closes those who opened a business; staff ask, dismiss or restrict in admin.
CREATE TABLE "business_suspicions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"reasons" jsonb NOT NULL,
	"root_slugs" text[] NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"asked_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	CONSTRAINT "business_suspicions_status_check" CHECK ("business_suspicions"."status" IN ('open', 'asked', 'restricted', 'dismissed', 'switched'))
);
--> statement-breakpoint
ALTER TABLE "business_suspicions" ADD CONSTRAINT "business_suspicions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_suspicions" ADD CONSTRAINT "business_suspicions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_suspicions_live_key" ON "business_suspicions" USING btree ("user_id") WHERE status IN ('open', 'asked', 'restricted');--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON business_suspicions TO classifieds_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON business_suspicions TO classifieds_worker;--> statement-breakpoint
GRANT SELECT ON business_suspicions TO classifieds_readonly;
