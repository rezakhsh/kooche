-- Country modes and emergency pauses (wave 2 part 2, docs/setup.md, "Country modes"). Each
-- country keeps what it does today: the open ones (Germany) 'open', Turkey 'guide', the rest
-- 'waitlist'; is_active follows the mode from now on.
CREATE TABLE "category_pauses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"location_id" uuid,
	"reason" text NOT NULL,
	"until" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid,
	"lifted_at" timestamp with time zone,
	"lifted_by_user_id" uuid,
	CONSTRAINT "category_pauses_reason_check" CHECK (char_length("category_pauses"."reason") BETWEEN 3 AND 500)
);
--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "mode" text DEFAULT 'waitlist' NOT NULL;--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "opens_on" date;--> statement-breakpoint
UPDATE "countries" SET "mode" = CASE WHEN "is_active" THEN 'open' WHEN "code" = 'TR' THEN 'guide' ELSE 'waitlist' END;--> statement-breakpoint
ALTER TABLE "category_pauses" ADD CONSTRAINT "category_pauses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_pauses" ADD CONSTRAINT "category_pauses_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_pauses" ADD CONSTRAINT "category_pauses_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_pauses" ADD CONSTRAINT "category_pauses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_pauses" ADD CONSTRAINT "category_pauses_lifted_by_user_id_users_id_fk" FOREIGN KEY ("lifted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_pauses_country_code_idx" ON "category_pauses" USING btree ("country_code","until") WHERE "category_pauses"."lifted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_mode_check" CHECK ("countries"."mode" IN ('hidden', 'waitlist', 'prestart', 'guide', 'open'));--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_is_active_check" CHECK ("countries"."is_active" = ("countries"."mode" = 'open'));--> statement-breakpoint
-- The owner sets modes and pauses in admin (the web app); the worker only reads them
GRANT UPDATE (mode, is_active, opens_on) ON countries TO classifieds_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON category_pauses TO classifieds_app;--> statement-breakpoint
GRANT SELECT ON category_pauses TO classifieds_worker;--> statement-breakpoint
GRANT SELECT ON category_pauses TO classifieds_readonly;
