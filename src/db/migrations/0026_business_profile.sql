-- Wave 1, part 7 (mockups final/business-new and business-page): what a business does, one line
-- under its name, the languages it serves in, "online too", Instagram and Telegram, opening hours.
-- Columns only; the grants on organizations (0003) cover them.
ALTER TABLE "organizations" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "languages" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "serves_online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "telegram" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "opening_hours" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_business_type_check" CHECK ("organizations"."business_type" IN ('translation', 'repairs', 'beauty', 'education', 'real_estate', 'auto', 'food', 'legal_finance', 'health', 'moving', 'shop', 'other'));--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tagline_check" CHECK (char_length("organizations"."tagline") BETWEEN 2 AND 100);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_languages_check" CHECK ("organizations"."languages" <@ ARRAY['fa', 'de', 'en', 'tr', 'ar', 'fr', 'other']::text[]);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_instagram_check" CHECK ("organizations"."instagram" ~ '^[A-Za-z0-9._]{1,30}$');--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_telegram_check" CHECK ("organizations"."telegram" ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$');--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_opening_hours_check" CHECK (jsonb_typeof("organizations"."opening_hours") = 'object');