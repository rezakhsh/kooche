CREATE TABLE "order_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"receipt_email" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"refund_minor" bigint,
	"currency" text NOT NULL,
	"provider_refund_id" text,
	"processed_at" timestamp with time zone,
	CONSTRAINT "order_withdrawals_order_id_key" UNIQUE("order_id"),
	CONSTRAINT "order_withdrawals_status_check" CHECK ("order_withdrawals"."status" IN ('received', 'refunded', 'no_refund')),
	CONSTRAINT "order_withdrawals_refund_minor_check" CHECK ("order_withdrawals"."refund_minor" >= 0),
	CONSTRAINT "order_withdrawals_processed_check" CHECK (("order_withdrawals"."status" = 'received') = ("order_withdrawals"."processed_at" IS NULL)),
	CONSTRAINT "order_withdrawals_refunded_check" CHECK ("order_withdrawals"."status" <> 'refunded' OR ("order_withdrawals"."refund_minor" > 0 AND "order_withdrawals"."provider_refund_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "order_withdrawals" ADD CONSTRAINT "order_withdrawals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_withdrawals" ADD CONSTRAINT "order_withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_withdrawals" ADD CONSTRAINT "order_withdrawals_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_withdrawals_user_id_idx" ON "order_withdrawals" USING btree ("user_id");--> statement-breakpoint
-- The web records a withdrawal (one per order, so pressing twice does nothing); the worker fills in
-- the refund; backups read everything. Nobody deletes one.
GRANT SELECT, INSERT (order_id, user_id, receipt_email, currency) ON order_withdrawals TO classifieds_app;--> statement-breakpoint
GRANT SELECT, UPDATE (status, refund_minor, provider_refund_id, processed_at) ON order_withdrawals TO classifieds_worker;--> statement-breakpoint
GRANT SELECT ON order_withdrawals TO classifieds_readonly;
