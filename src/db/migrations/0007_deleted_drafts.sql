ALTER TABLE "listings" DROP CONSTRAINT "listings_publishable_check";--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT "listings_price_required_check";--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_publishable_check" CHECK ("listings"."status" IN ('draft', 'deleted') OR (
        "listings"."category_id" IS NOT NULL AND "listings"."country_code" IS NOT NULL AND "listings"."location_id" IS NOT NULL
        AND "listings"."point" IS NOT NULL AND "listings"."location_precision" IS NOT NULL
        AND char_length("listings"."title") >= 3));--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_required_check" CHECK ("listings"."status" IN ('draft', 'deleted') OR ("listings"."price_type" IN ('fixed', 'negotiable')) = ("listings"."price_minor" IS NOT NULL));