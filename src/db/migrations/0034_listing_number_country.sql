-- The country of the poster's verified number when a listing went out (wave 2 part 5, posting
-- across borders; src/modules/listings/zones.ts). Older listings keep null. The app and the worker
-- already have UPDATE on listings.
ALTER TABLE "listings" ADD COLUMN "number_country" text;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_number_country_check" CHECK ("listings"."number_country" ~ '^[A-Z]{2}$');