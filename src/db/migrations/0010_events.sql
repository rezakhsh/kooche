CREATE TABLE "event_dates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"listing_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"location_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_dates_listing_id_starts_at_key" UNIQUE("listing_id","starts_at"),
	CONSTRAINT "event_dates_order_check" CHECK ("event_dates"."ends_at" > "event_dates"."starts_at"),
	CONSTRAINT "event_dates_duration_check" CHECK ("event_dates"."ends_at" <= "event_dates"."starts_at" + interval '14 days')
);
--> statement-breakpoint
CREATE TABLE "event_details" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"attendance" text DEFAULT 'in_person' NOT NULL,
	"venue_name" text,
	"venue_name_normalized" text,
	"street_address" text,
	"online_url" text,
	"ticket_url" text,
	"organizer_name" text,
	"organizer_name_normalized" text,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"min_age" smallint,
	"time_zone" text NOT NULL,
	"repeat" text DEFAULT 'none' NOT NULL,
	"repeat_until" date,
	"schedule_status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_details_attendance_check" CHECK ("event_details"."attendance" IN ('in_person', 'online', 'hybrid')),
	CONSTRAINT "event_details_venue_name_check" CHECK (char_length("event_details"."venue_name") BETWEEN 1 AND 100),
	CONSTRAINT "event_details_venue_name_normalized_check" CHECK (("event_details"."venue_name" IS NULL) = ("event_details"."venue_name_normalized" IS NULL)),
	CONSTRAINT "event_details_street_address_check" CHECK (char_length("event_details"."street_address") BETWEEN 1 AND 120),
	CONSTRAINT "event_details_online_url_check" CHECK ("event_details"."online_url" ~ '^https://[^\s]{4,}$' AND char_length("event_details"."online_url") <= 500),
	CONSTRAINT "event_details_ticket_url_check" CHECK ("event_details"."ticket_url" ~ '^https://[^\s]{4,}$' AND char_length("event_details"."ticket_url") <= 500),
	CONSTRAINT "event_details_organizer_name_check" CHECK (char_length("event_details"."organizer_name") BETWEEN 1 AND 80),
	CONSTRAINT "event_details_organizer_name_normalized_check" CHECK (("event_details"."organizer_name" IS NULL) = ("event_details"."organizer_name_normalized" IS NULL)),
	CONSTRAINT "event_details_languages_check" CHECK ("event_details"."languages" <@ ARRAY['fa', 'de', 'en', 'other']::text[]),
	CONSTRAINT "event_details_min_age_check" CHECK ("event_details"."min_age" BETWEEN 1 AND 21),
	CONSTRAINT "event_details_time_zone_check" CHECK ("event_details"."time_zone" ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'),
	CONSTRAINT "event_details_repeat_check" CHECK ("event_details"."repeat" IN ('none', 'weekly', 'monthly')),
	CONSTRAINT "event_details_repeat_until_check" CHECK (("event_details"."repeat" = 'none') = ("event_details"."repeat_until" IS NULL)),
	CONSTRAINT "event_details_schedule_status_check" CHECK ("event_details"."schedule_status" IN ('scheduled', 'postponed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "event_dates" ADD CONSTRAINT "event_dates_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_dates" ADD CONSTRAINT "event_dates_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_dates" ADD CONSTRAINT "event_dates_location_fkey" FOREIGN KEY ("location_id","country_code") REFERENCES "public"."locations"("id","country_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_dates_country_ends_idx" ON "event_dates" USING btree ("country_code","ends_at");--> statement-breakpoint
CREATE INDEX "event_dates_location_ends_idx" ON "event_dates" USING btree ("location_id","ends_at");--> statement-breakpoint
-- The app writes events (details and dates replaced on edit); the worker only reads them (the
-- weekly digest). Purging a listing removes both through the cascades.
GRANT SELECT, INSERT, UPDATE, DELETE ON event_details, event_dates TO classifieds_app;
--> statement-breakpoint
GRANT SELECT ON event_details, event_dates TO classifieds_worker, classifieds_readonly;
--> statement-breakpoint
CREATE TRIGGER event_details_set_updated_at BEFORE UPDATE ON event_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
