CREATE TABLE "organization_follows" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_follows_pkey" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD COLUMN "reminded_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_details" ADD COLUMN "seating" text;--> statement-breakpoint
ALTER TABLE "event_details" ADD COLUMN "step_free" boolean;--> statement-breakpoint
ALTER TABLE "event_details" ADD COLUMN "refund_note" text;--> statement-breakpoint
ALTER TABLE "event_details" ADD COLUMN "door_sales" boolean;--> statement-breakpoint
ALTER TABLE "event_details" ADD COLUMN "open_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_details" ADD COLUMN "performers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_follows" ADD CONSTRAINT "organization_follows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_follows" ADD CONSTRAINT "organization_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_follows_user_id_idx" ON "organization_follows" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_seating_check" CHECK ("event_details"."seating" IN ('numbered', 'seated', 'standing', 'mixed'));--> statement-breakpoint
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_refund_note_check" CHECK (char_length("event_details"."refund_note") BETWEEN 1 AND 80);--> statement-breakpoint
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_performers_check" CHECK (jsonb_typeof("event_details"."performers") = 'array' AND jsonb_array_length("event_details"."performers") <= 8);--> statement-breakpoint
-- The web follows and unfollows; the worker reads followers when a business publishes an event,
-- and marks the reminder sent on a saved event (favorites: UPDATE since 0003); backups read all.
GRANT SELECT, INSERT, DELETE ON organization_follows TO classifieds_app;--> statement-breakpoint
GRANT SELECT ON organization_follows TO classifieds_worker, classifieds_readonly;--> statement-breakpoint
-- erase_user (0008) as before, now also deleting the account's follows. CREATE OR REPLACE keeps
-- its owner and grants.
CREATE OR REPLACE FUNCTION erase_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user users%ROWTYPE;
  v_org uuid;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'erase_user: user % does not exist', p_user_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_user.status = 'deleted' THEN
    RETURN;
  END IF;

  -- Same lock order as the app's "at least one owner" rule: organization rows first.
  PERFORM 1 FROM organizations o
  WHERE o.id IN (SELECT organization_id FROM organization_members WHERE user_id = p_user_id AND role = 'owner')
  ORDER BY o.id FOR UPDATE;

  SELECT m.organization_id INTO v_org
  FROM organization_members m
  JOIN organizations o ON o.id = m.organization_id AND o.status <> 'deleted'
  WHERE m.user_id = p_user_id AND m.role = 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM organization_members m2
      WHERE m2.organization_id = m.organization_id AND m2.role = 'owner' AND m2.user_id <> p_user_id)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'erase_user: user % is the only owner of organization %', p_user_id, v_org
      USING ERRCODE = 'restrict_violation',
            HINT = 'Pass ownership on or delete the organization first.';
  END IF;

  WITH gone AS (
    UPDATE listings
    SET status = 'deleted', deleted_at = now(), status_changed_at = now()
    WHERE user_id = p_user_id AND organization_id IS NULL AND status <> 'deleted'
    RETURNING id, revision, old.status AS from_status
  ), events AS (
    INSERT INTO listing_events (listing_id, event_type, actor_type, from_status, to_status, revision, data)
    SELECT id, 'deleted', 'system', from_status, 'deleted', revision, '{"reason": "account_deleted"}'::jsonb
    FROM gone
  )
  INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id)
  SELECT 'listing.deleted', 'listing', id FROM gone;

  UPDATE conversations SET status = 'closed'
  WHERE (buyer_user_id = p_user_id OR seller_user_id = p_user_id) AND status = 'open';

  DELETE FROM sessions WHERE user_id = p_user_id;
  DELETE FROM auth_accounts WHERE user_id = p_user_id;
  DELETE FROM two_factors WHERE user_id = p_user_id;
  DELETE FROM favorites WHERE user_id = p_user_id;
  DELETE FROM organization_follows WHERE user_id = p_user_id;
  DELETE FROM saved_searches WHERE user_id = p_user_id;
  DELETE FROM organization_members WHERE user_id = p_user_id;
  DELETE FROM user_blocks WHERE blocker_user_id = p_user_id OR blocked_user_id = p_user_id;
  DELETE FROM phone_verifications WHERE user_id = p_user_id;
  DELETE FROM verifications WHERE identifier = v_user.email;
  DELETE FROM organization_invitations
  WHERE accepted_at IS NULL
    AND (email = v_user.email OR (v_user.phone_e164 IS NOT NULL AND phone_e164 = v_user.phone_e164));

  UPDATE users SET
    email = 'deleted-' || id || '@deleted.invalid',
    email_verified = false,
    display_name = 'کاربر حذف‌شده',
    display_name_normalized = 'کاربر حذف‌شده',
    avatar_key = NULL,
    phone_e164 = NULL,
    phone_verified_at = NULL,
    phone_verification_method = NULL,
    telegram_user_id = NULL,
    staff_role = NULL,
    two_factor_enabled = false,
    home_location_id = NULL,
    home_postal_code = NULL,
    home_place_name = NULL,
    home_district = NULL,
    notification_prefs = '{}'::jsonb,
    last_seen_at = NULL,
    status = 'deleted',
    deleted_at = now()
  WHERE id = p_user_id;

  -- The worker deletes the avatar object from storage; the key is gone from the row by now.
  INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
  VALUES ('user.erased', 'user', p_user_id,
          jsonb_strip_nulls(jsonb_build_object('avatar_key', v_user.avatar_key)));

  INSERT INTO audit_log (actor_type, action, target_type, target_id)
  VALUES ('system', 'user.erased', 'user', p_user_id);
END
$$;
