CREATE TABLE "sitemap_files" (
	"name" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"url_count" integer NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sitemap_files_name_check" CHECK ("sitemap_files"."name" ~ '^[a-z0-9-]{1,80}$'),
	CONSTRAINT "sitemap_files_url_count_check" CHECK ("sitemap_files"."url_count" BETWEEN 0 AND 50000)
);
--> statement-breakpoint
CREATE INDEX "listings_country_postal_idx" ON "listings" USING btree ("country_code","postal_code") WHERE status = 'active' AND postal_code IS NOT NULL;--> statement-breakpoint
-- The worker writes the sitemaps every hour; the app only serves them.
GRANT SELECT, INSERT, UPDATE, DELETE ON sitemap_files TO classifieds_worker;
--> statement-breakpoint
GRANT SELECT ON sitemap_files TO classifieds_app, classifieds_readonly;
