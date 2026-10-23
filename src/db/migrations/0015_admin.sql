-- The admin page (roadmap step 8, docs/schema.md section 17): the code on every listing, the
-- staff TOTP step-up on sessions, Better Auth's two-factor fields, appeals, and one open report
-- per person per user or business. Additive only: the running code keeps working on it.

-- Listing codes: 9 digits from a sequence through a fixed bijection of [0, 900,000,000), so codes
-- never collide, need no retry and don't count up visibly. 738147101 is coprime to 900,000,000
-- (not divisible by 2, 3 or 5), which makes n -> n * A + B mod 900,000,000 a permutation.
CREATE SEQUENCE listings_ref_number_seq AS bigint MINVALUE 0 MAXVALUE 899999999 START 0 NO CYCLE;
--> statement-breakpoint
CREATE FUNCTION listing_ref_number(n bigint) RETURNS bigint
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  RETURN 100000000 + ((n * 738147101 + 417793233) % 900000000);
--> statement-breakpoint
CREATE TABLE "moderation_appeals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decision_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "moderation_appeals_decision_id_key" UNIQUE("decision_id"),
	CONSTRAINT "moderation_appeals_body_check" CHECK (char_length("moderation_appeals"."body") BETWEEN 1 AND 2000),
	CONSTRAINT "moderation_appeals_status_check" CHECK ("moderation_appeals"."status" IN ('open', 'decided')),
	CONSTRAINT "moderation_appeals_decided_check" CHECK (("moderation_appeals"."status" = 'decided') = ("moderation_appeals"."decided_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "ref_number" bigint DEFAULT listing_ref_number(nextval('listings_ref_number_seq')) NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "staff_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "two_factors" ADD COLUMN "verified" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factors" ADD COLUMN "failed_verification_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factors" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_decision_id_moderation_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."moderation_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_appeals_queue_idx" ON "moderation_appeals" USING btree ("created_at") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "moderation_appeals_user_id_idx" ON "moderation_appeals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_per_reporter_user_key" ON "reports" USING btree ("reporter_user_id","reported_user_id") WHERE status IN ('open', 'in_review') AND reporter_user_id IS NOT NULL AND reported_user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_per_reporter_organization_key" ON "reports" USING btree ("reporter_user_id","organization_id") WHERE status IN ('open', 'in_review') AND reporter_user_id IS NOT NULL AND organization_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "reports_organization_id_idx" ON "reports" USING btree ("organization_id") WHERE organization_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_ref_number_key" UNIQUE("ref_number");
--> statement-breakpoint
CREATE TRIGGER moderation_appeals_set_updated_at BEFORE UPDATE ON moderation_appeals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
-- Inserting a listing draws its code: both roles that insert listings need the sequence
GRANT USAGE ON SEQUENCE listings_ref_number_seq TO classifieds_app, classifieds_worker;
--> statement-breakpoint
GRANT SELECT ON SEQUENCE listings_ref_number_seq TO classifieds_readonly;
--> statement-breakpoint
-- Appeals: written by the app (the user appeals, staff answer); never deleted by running code
GRANT SELECT, INSERT, UPDATE ON moderation_appeals TO classifieds_app, classifieds_worker;
--> statement-breakpoint
GRANT SELECT ON moderation_appeals TO classifieds_readonly;
