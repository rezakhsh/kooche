ALTER TABLE "listings" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "district_normalized" text;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_district_check" CHECK (char_length("listings"."district") BETWEEN 1 AND 60);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_district_normalized_check" CHECK (("listings"."district" IS NULL) = ("listings"."district_normalized" IS NULL));