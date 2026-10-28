-- Test accounts (wave 2 part 1, docs/setup.md, "Test accounts"): one per planned country plus the
-- owner's own accounts kept for testing. Set only by scripts/test-accounts.ts as classifieds_owner.
ALTER TABLE "users" ADD COLUMN "test_account" text;--> statement-breakpoint
CREATE INDEX "users_test_account_idx" ON "users" USING btree ("id") WHERE "users"."test_account" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_test_account_check" CHECK ("users"."test_account" IN ('country', 'personal'));