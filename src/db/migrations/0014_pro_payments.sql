ALTER TABLE "organizations" ADD COLUMN "legal_form" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "representative_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "register_court" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "imprint_extra" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "place_name" text;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "provider_invoice_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer_country" text;--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_provider_invoice_id_key" ON "entitlements" USING btree ("provider_invoice_id") WHERE provider_invoice_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_legal_form_check" CHECK (char_length("organizations"."legal_form") BETWEEN 1 AND 80);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_representative_name_check" CHECK (char_length("organizations"."representative_name") BETWEEN 2 AND 120);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_register_court_check" CHECK (char_length("organizations"."register_court") BETWEEN 2 AND 120);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_imprint_extra_check" CHECK (char_length("organizations"."imprint_extra") BETWEEN 1 AND 2000);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_country_check" CHECK ("orders"."buyer_country" ~ '^[A-Z]{2}$');--> statement-breakpoint
-- The app starts a checkout with a pending order and nothing more: it may insert only the columns
-- of a pending order, so status, paid_at, buyer_country and the invoice keep their defaults until
-- the worker applies the provider's webhook (docs/schema.md, sections 12 and 13).
REVOKE INSERT ON orders FROM classifieds_app;
--> statement-breakpoint
GRANT INSERT (buyer_user_id, organization_id, product_id, product_price_id, listing_id, currency,
  subtotal_minor, discount_minor, tax_minor, total_minor, provider) ON orders TO classifieds_app;
