-- When the owner last opened a country (wave 2 part 8): its first page is the starter page for
-- 8 weeks after (src/modules/launch/country-page.ts). Germany, open from the start, keeps null.
ALTER TABLE "countries" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
GRANT UPDATE (opened_at) ON countries TO classifieds_app;
