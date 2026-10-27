CREATE TABLE "neighbourhoods" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"location_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name_local" text NOT NULL,
	"name_fa" text NOT NULL,
	"boundary" geography(MultiPolygon,4326) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "neighbourhoods_location_id_key_key" UNIQUE("location_id","key"),
	CONSTRAINT "neighbourhoods_key_check" CHECK (char_length("neighbourhoods"."key") BETWEEN 1 AND 40),
	CONSTRAINT "neighbourhoods_name_local_check" CHECK (char_length("neighbourhoods"."name_local") BETWEEN 1 AND 100),
	CONSTRAINT "neighbourhoods_name_fa_check" CHECK (char_length("neighbourhoods"."name_fa") BETWEEN 1 AND 100)
);
--> statement-breakpoint
ALTER TABLE "neighbourhoods" ADD CONSTRAINT "neighbourhoods_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "neighbourhoods_boundary_idx" ON "neighbourhoods" USING gist ("boundary");--> statement-breakpoint
CREATE TRIGGER neighbourhoods_set_updated_at BEFORE UPDATE ON neighbourhoods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
-- Reference data written by the seed (classifieds_owner); everyone else only reads it
GRANT SELECT ON neighbourhoods TO classifieds_app, classifieds_worker, classifieds_readonly;
