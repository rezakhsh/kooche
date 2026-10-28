-- The street map (docs/setup.md, "The street map"): postal code areas from OpenStreetMap, and the
-- optional exact spot of an event's venue and a business's shop, tapped on the map by its owner.
CREATE TABLE "postal_areas" (
	"country_code" text NOT NULL,
	"postal_code" text NOT NULL,
	"boundary" geography(MultiPolygon,4326) NOT NULL,
	CONSTRAINT "postal_areas_country_code_postal_code_pk" PRIMARY KEY("country_code","postal_code"),
	CONSTRAINT "postal_areas_postal_code_check" CHECK ("postal_areas"."postal_code" ~ '^[0-9A-Z][0-9A-Z -]{1,9}$')
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "pin" geography(Point,4326);--> statement-breakpoint
ALTER TABLE "event_details" ADD COLUMN "venue_pin" geography(Point,4326);--> statement-breakpoint
ALTER TABLE "postal_areas" ADD CONSTRAINT "postal_areas_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Reference data written by the seed (classifieds_owner); everyone else only reads it
GRANT SELECT ON postal_areas TO classifieds_app, classifieds_worker, classifieds_readonly;
