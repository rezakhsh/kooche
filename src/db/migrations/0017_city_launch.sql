ALTER TABLE "locations" ADD COLUMN "launch_status" text DEFAULT 'later' NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "business_goal" smallint;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "launch_radius_km" smallint;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "launch_with_id" uuid;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_launch_with_fkey" FOREIGN KEY ("launch_with_id","country_code") REFERENCES "public"."locations"("id","country_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_launch_status_check" CHECK ("locations"."launch_status" IN ('open', 'waitlist', 'later'));--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_business_goal_check" CHECK ("locations"."business_goal" BETWEEN 1 AND 1000);--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_launch_radius_km_check" CHECK ("locations"."launch_radius_km" BETWEEN 1 AND 500);--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_launch_city_check" CHECK ("locations"."kind" = 'city' OR ("locations"."launch_status" = 'later' AND num_nonnulls("locations"."business_goal", "locations"."launch_radius_km", "locations"."launch_with_id", "locations"."opened_at") = 0));--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_launch_with_check" CHECK ("locations"."launch_with_id" <> "locations"."id");--> statement-breakpoint
-- Existing databases (staging, production before go-live): the round 12 starting point, the same
-- values the seed gives new cities (seed/locations/de.ts). Only the Berlin area is open; four key
-- cities wait for their verified businesses; every other city opens with the whole country.
UPDATE locations SET launch_status = 'open', launch_radius_km = 40, opened_at = now()
WHERE kind = 'city' AND slug = 'berlin';--> statement-breakpoint
UPDATE locations SET launch_status = 'open', opened_at = now(),
  launch_with_id = (SELECT id FROM locations WHERE kind = 'city' AND slug = 'berlin')
WHERE kind = 'city' AND slug = 'potsdam';--> statement-breakpoint
UPDATE locations SET launch_status = 'waitlist', business_goal = 20 WHERE kind = 'city' AND slug IN ('hamburg', 'duesseldorf', 'frankfurt');--> statement-breakpoint
UPDATE locations SET launch_status = 'waitlist', business_goal = 25 WHERE kind = 'city' AND slug = 'koeln';--> statement-breakpoint
UPDATE locations SET launch_status = 'waitlist',
  launch_with_id = (SELECT id FROM locations WHERE kind = 'city' AND slug = 'koeln')
WHERE kind = 'city' AND slug = 'bonn';--> statement-breakpoint
-- Austria closed for now (owner, round 7); seed/countries.ts says the same for a fresh database
UPDATE countries SET is_active = false WHERE code = 'AT';
