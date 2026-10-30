CREATE TABLE "ref_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"created_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	CONSTRAINT "ref_codes_code_check" CHECK ("ref_codes"."code" ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
	CONSTRAINT "ref_codes_label_check" CHECK (char_length("ref_codes"."label") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "visit_stats" (
	"day" date NOT NULL,
	"dimension" text NOT NULL,
	"key" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "visit_stats_day_dimension_key_pk" PRIMARY KEY("day","dimension","key"),
	CONSTRAINT "visit_stats_dimension_check" CHECK ("visit_stats"."dimension" IN ('total', 'source', 'country', 'page', 'device')),
	CONSTRAINT "visit_stats_key_check" CHECK (char_length("visit_stats"."key") BETWEEN 1 AND 120),
	CONSTRAINT "visit_stats_counts_check" CHECK ("visit_stats"."views" >= 0 AND "visit_stats"."visitors" >= 0)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_source" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_answer" text;--> statement-breakpoint
ALTER TABLE "ref_codes" ADD CONSTRAINT "ref_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ref_codes_code_key" ON "ref_codes" USING btree ("code");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_signup_source_check" CHECK ("users"."signup_source" ~ '^(ref:)?[a-z0-9.-]{1,40}$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_signup_answer_check" CHECK ("users"."signup_answer" IN ('friend', 'instagram', 'telegram', 'google', 'shop', 'event', 'other', 'skipped'));--> statement-breakpoint
GRANT SELECT ON visit_stats TO classifieds_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON visit_stats TO classifieds_worker;--> statement-breakpoint
GRANT SELECT, INSERT ON ref_codes TO classifieds_app;--> statement-breakpoint
GRANT UPDATE (label, archived_at) ON ref_codes TO classifieds_app;--> statement-breakpoint
GRANT SELECT ON ref_codes TO classifieds_worker;--> statement-breakpoint
GRANT SELECT ON visit_stats, ref_codes TO classifieds_readonly;
