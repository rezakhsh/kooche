-- The waitlist reward (wave 2 part 9; src/modules/launch/rewards.ts). The app writes the rewards
-- when the owner opens a city (in the same transaction) and marks one used; the worker sends the
-- "ready" email and applies the bump (src/modules/payments/bumps.ts), or frees the reward again
-- when the listing closed before it ran.
CREATE TABLE "waitlist_rewards" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"waitlist_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"available_from" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notified_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"user_id" uuid,
	"listing_id" uuid,
	"applied_at" timestamp with time zone,
	CONSTRAINT "waitlist_rewards_waitlist_id_key" UNIQUE("waitlist_id"),
	CONSTRAINT "waitlist_rewards_window_check" CHECK ("waitlist_rewards"."ends_at" > "waitlist_rewards"."available_from"),
	CONSTRAINT "waitlist_rewards_used_check" CHECK (("waitlist_rewards"."used_at" IS NULL) = ("waitlist_rewards"."user_id" IS NULL) AND ("waitlist_rewards"."used_at" IS NOT NULL OR "waitlist_rewards"."listing_id" IS NULL)),
	CONSTRAINT "waitlist_rewards_applied_check" CHECK ("waitlist_rewards"."applied_at" IS NULL OR "waitlist_rewards"."used_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "waitlist_rewards" ADD CONSTRAINT "waitlist_rewards_waitlist_id_city_waitlist_id_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."city_waitlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_rewards" ADD CONSTRAINT "waitlist_rewards_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_rewards" ADD CONSTRAINT "waitlist_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_rewards" ADD CONSTRAINT "waitlist_rewards_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waitlist_rewards_due_idx" ON "waitlist_rewards" USING btree ("used_at") WHERE "waitlist_rewards"."used_at" IS NOT NULL AND "waitlist_rewards"."applied_at" IS NULL;--> statement-breakpoint
CREATE INDEX "waitlist_rewards_notify_idx" ON "waitlist_rewards" USING btree ("available_from") WHERE "waitlist_rewards"."notified_at" IS NULL;--> statement-breakpoint
GRANT SELECT, INSERT ON waitlist_rewards TO classifieds_app;--> statement-breakpoint
GRANT UPDATE (used_at, user_id, listing_id) ON waitlist_rewards TO classifieds_app;--> statement-breakpoint
GRANT SELECT ON waitlist_rewards TO classifieds_worker;--> statement-breakpoint
GRANT UPDATE (notified_at, applied_at, used_at, user_id, listing_id) ON waitlist_rewards TO classifieds_worker;--> statement-breakpoint
GRANT SELECT ON waitlist_rewards TO classifieds_readonly;
