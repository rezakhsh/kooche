CREATE TABLE "city_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"location_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"confirm_token_hash" "bytea" NOT NULL,
	"confirmed_at" timestamp with time zone,
	"leave_token" text NOT NULL,
	CONSTRAINT "city_waitlist_confirm_token_hash_key" UNIQUE("confirm_token_hash"),
	CONSTRAINT "city_waitlist_leave_token_key" UNIQUE("leave_token"),
	CONSTRAINT "city_waitlist_location_id_email_key" UNIQUE("location_id","email"),
	CONSTRAINT "city_waitlist_email_check" CHECK ("city_waitlist"."email" = lower("city_waitlist"."email") AND char_length("city_waitlist"."email") BETWEEN 3 AND 254),
	CONSTRAINT "city_waitlist_role_check" CHECK ("city_waitlist"."role" IN ('looking', 'private', 'business')),
	CONSTRAINT "city_waitlist_leave_token_check" CHECK ("city_waitlist"."leave_token" ~ '^[A-Za-z0-9_-]{32}$')
);
--> statement-breakpoint
ALTER TABLE "city_waitlist" ADD CONSTRAINT "city_waitlist_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "city_waitlist_confirmed_idx" ON "city_waitlist" USING btree ("location_id","confirmed_at");--> statement-breakpoint
-- The web adds, confirms and deletes (leaving) signups; the worker deletes unconfirmed ones after
-- 30 days (retention); backups read everything.
GRANT SELECT, INSERT, UPDATE, DELETE ON city_waitlist TO classifieds_app;--> statement-breakpoint
GRANT SELECT, DELETE ON city_waitlist TO classifieds_worker;--> statement-breakpoint
GRANT SELECT ON city_waitlist TO classifieds_readonly;
--> statement-breakpoint
-- Cities stay reference data written by the seed, except their launch, which the owner changes in
-- admin (src/modules/launch/waitlist.ts): only these columns.
GRANT UPDATE (launch_status, business_goal, launch_radius_km, opened_at) ON locations TO classifieds_app;
