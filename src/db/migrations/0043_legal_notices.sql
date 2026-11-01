-- Check B (Nov 1, 2026): the email to every account before the terms of use or the privacy policy
-- change (terms 12: four weeks ahead; src/modules/legal/notices.ts). A draft, then one row per
-- account with the time it went out.
CREATE TABLE "legal_notice_recipients" (
	"notice_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"attempts" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "legal_notice_recipients_pkey" PRIMARY KEY("notice_id","user_id"),
	CONSTRAINT "legal_notice_recipients_done_check" CHECK ("legal_notice_recipients"."sent_at" IS NULL OR "legal_notice_recipients"."failed_at" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "legal_notices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"documents" text[] NOT NULL,
	"effective_on" date NOT NULL,
	"summary_fa" text NOT NULL,
	"summary_de" text NOT NULL,
	"created_by_user_id" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_user_id" uuid,
	"recipients" integer,
	"finished_at" timestamp with time zone,
	CONSTRAINT "legal_notices_documents_check" CHECK (cardinality("legal_notices"."documents") BETWEEN 1 AND 2 AND "legal_notices"."documents" <@ ARRAY['terms', 'privacy']::text[]),
	CONSTRAINT "legal_notices_summary_check" CHECK (char_length("legal_notices"."summary_fa") BETWEEN 1 AND 2000 AND char_length("legal_notices"."summary_de") BETWEEN 1 AND 2000),
	CONSTRAINT "legal_notices_confirmed_check" CHECK (("legal_notices"."confirmed_at" IS NULL) = ("legal_notices"."recipients" IS NULL) AND ("legal_notices"."finished_at" IS NULL OR "legal_notices"."confirmed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "legal_notice_recipients" ADD CONSTRAINT "legal_notice_recipients_notice_id_legal_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."legal_notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_notice_recipients" ADD CONSTRAINT "legal_notice_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_notices" ADD CONSTRAINT "legal_notices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_notices" ADD CONSTRAINT "legal_notices_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legal_notice_recipients_due_idx" ON "legal_notice_recipients" USING btree ("notice_id","attempts") WHERE "legal_notice_recipients"."sent_at" IS NULL AND "legal_notice_recipients"."failed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "legal_notice_recipients_user_idx" ON "legal_notice_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "legal_notices_confirmed_idx" ON "legal_notices" USING btree ("effective_on") WHERE "legal_notices"."confirmed_at" IS NOT NULL;--> statement-breakpoint
-- The app writes drafts and confirms them with their recipients (admin, owner only); the worker
-- marks each send and the end. Nobody else changes a confirmed notice or its rows.
GRANT SELECT, INSERT, DELETE ON legal_notices TO classifieds_app;--> statement-breakpoint
GRANT UPDATE (documents, effective_on, summary_fa, summary_de, confirmed_at, confirmed_by_user_id, recipients) ON legal_notices TO classifieds_app;--> statement-breakpoint
GRANT SELECT, INSERT ON legal_notice_recipients TO classifieds_app;--> statement-breakpoint
GRANT SELECT ON legal_notices TO classifieds_worker;--> statement-breakpoint
GRANT UPDATE (finished_at) ON legal_notices TO classifieds_worker;--> statement-breakpoint
GRANT SELECT ON legal_notice_recipients TO classifieds_worker;--> statement-breakpoint
GRANT UPDATE (sent_at, failed_at, attempts) ON legal_notice_recipients TO classifieds_worker;--> statement-breakpoint
GRANT SELECT ON legal_notices, legal_notice_recipients TO classifieds_readonly;--> statement-breakpoint
-- erase_user also deletes the person's rows of these emails (Check B, Nov 1, 2026: the proof
-- that someone was told goes with the account). Otherwise as in migration 0040.
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

  -- A business the person owns alone closes with the account (owner's choice, Check B, Oct 31,
  -- 2026): it was refused before, and no one could close a business, so a sole owner could never
  -- delete their account. Its listings go offline, its open invitations end, its members leave.
  -- The app refuses first while such a business has a paid plan that still renews.
  FOR v_org IN
    SELECT m.organization_id
    FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id AND o.status <> 'deleted'
    WHERE m.user_id = p_user_id AND m.role = 'owner'
      AND NOT EXISTS (
        SELECT 1 FROM organization_members m2
        WHERE m2.organization_id = m.organization_id AND m2.role = 'owner' AND m2.user_id <> p_user_id)
  LOOP
    UPDATE organizations SET status = 'deleted', deleted_at = now() WHERE id = v_org;
    WITH gone AS (
      UPDATE listings
      SET status = 'deleted', deleted_at = now(), status_changed_at = now()
      WHERE organization_id = v_org AND status <> 'deleted'
      RETURNING id, revision, old.status AS from_status
    ), events AS (
      INSERT INTO listing_events (listing_id, event_type, actor_type, from_status, to_status, revision, data)
      SELECT id, 'deleted', 'system', from_status, 'deleted', revision, '{"reason": "business_closed"}'::jsonb
      FROM gone
    )
    INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id)
    SELECT 'listing.deleted', 'listing', id FROM gone;
    UPDATE conversations SET status = 'closed'
    WHERE status = 'open' AND listing_id IN (SELECT id FROM listings WHERE organization_id = v_org);
    UPDATE organization_invitations SET revoked_at = now()
    WHERE organization_id = v_org AND accepted_at IS NULL AND revoked_at IS NULL;
    DELETE FROM organization_members WHERE organization_id = v_org;
    INSERT INTO audit_log (actor_type, action, target_type, target_id, data)
    VALUES ('system', 'organization.closed', 'organization', v_org, '{"reason": "owner_deleted"}'::jsonb);
  END LOOP;

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
  DELETE FROM legal_notice_recipients WHERE user_id = p_user_id;
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
    signup_source = NULL,
    signup_answer = NULL,
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
