CREATE TABLE "software_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"user_id" uuid,
	CONSTRAINT "software_dismissals_key_check" CHECK (char_length("software_dismissals"."key") BETWEEN 3 AND 600),
	CONSTRAINT "software_dismissals_reason_check" CHECK (char_length("software_dismissals"."reason") BETWEEN 3 AND 300)
);
--> statement-breakpoint
ALTER TABLE "software_dismissals" ADD CONSTRAINT "software_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "software_dismissals_key_key" ON "software_dismissals" USING btree ("key");--> statement-breakpoint
GRANT SELECT, INSERT ON software_dismissals TO classifieds_app;--> statement-breakpoint
GRANT SELECT ON software_dismissals TO classifieds_worker;--> statement-breakpoint
GRANT SELECT ON software_dismissals TO classifieds_readonly;
