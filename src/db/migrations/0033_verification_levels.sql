-- Business verification levels (wave 2 part 4, docs/setup.md, "Private or business"): the uploaded
-- proof (a private key, deleted 7 days after the decision), the VIES result and the sanctions check.
ALTER TABLE "organizations" ADD COLUMN "verification_document_key" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "verification_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "verification_document_delete_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "vat_check" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "sanctions_checked_at" timestamp with time zone;