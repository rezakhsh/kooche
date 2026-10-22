CREATE TABLE "saved_search_hits" (
	"saved_search_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "saved_search_hits_saved_search_id_listing_id_pk" PRIMARY KEY("saved_search_id","listing_id")
);
--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "unsubscribe_token" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_search_hits" ADD CONSTRAINT "saved_search_hits_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search_hits" ADD CONSTRAINT "saved_search_hits_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_search_hits_created_at_idx" ON "saved_search_hits" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_searches_unsubscribe_token_key" ON "saved_searches" USING btree ("unsubscribe_token");--> statement-breakpoint
-- The worker records matches and marks them sent; the app reads them (account export) and its
-- deletes of saved searches cascade. Backups read everything.
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_search_hits TO classifieds_worker;
--> statement-breakpoint
GRANT SELECT ON saved_search_hits TO classifieds_app, classifieds_readonly;
