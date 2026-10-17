CREATE TABLE "postal_places" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"country_code" text NOT NULL,
	"postal_code" text NOT NULL,
	"place_name" text NOT NULL,
	"place_search" text NOT NULL,
	"center" geography(Point,4326) NOT NULL,
	"location_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "postal_places_country_code_postal_code_place_name_key" UNIQUE("country_code","postal_code","place_name"),
	CONSTRAINT "postal_places_postal_code_check" CHECK ("postal_places"."postal_code" ~ '^[0-9A-Z][0-9A-Z -]{1,9}$'),
	CONSTRAINT "postal_places_place_name_check" CHECK (char_length("postal_places"."place_name") BETWEEN 1 AND 100)
);
--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT "listings_location_precision_check";--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "place_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "home_postal_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "home_place_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "home_district" text;--> statement-breakpoint
ALTER TABLE "postal_places" ADD CONSTRAINT "postal_places_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postal_places" ADD CONSTRAINT "postal_places_location_fkey" FOREIGN KEY ("location_id","country_code") REFERENCES "public"."locations"("id","country_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "postal_places_postal_code_idx" ON "postal_places" USING btree ("country_code","postal_code" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "postal_places_place_search_idx" ON "postal_places" USING btree ("country_code","place_search" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "postal_places_center_idx" ON "postal_places" USING gist ("center");--> statement-breakpoint
CREATE INDEX "listings_country_ranked_idx" ON "listings" USING btree ("country_code","ranked_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE status = 'active';--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_slug_key" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_slug_check" CHECK ("countries"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_postal_code_check" CHECK ("listings"."postal_code" ~ '^[0-9A-Z][0-9A-Z -]{1,9}$');--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_place_name_check" CHECK (char_length("listings"."place_name") BETWEEN 1 AND 100);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_location_precision_check" CHECK ("listings"."location_precision" IN ('city', 'postal_code', 'area'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_postal_code_check" CHECK ("users"."home_postal_code" ~ '^[0-9A-Z][0-9A-Z -]{1,9}$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_place_name_check" CHECK (char_length("users"."home_place_name") BETWEEN 1 AND 100);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_district_check" CHECK (char_length("users"."home_district") BETWEEN 1 AND 60);--> statement-breakpoint
-- Reference data like locations: written only by the seed (as the owner)
GRANT SELECT ON postal_places TO classifieds_app, classifieds_worker, classifieds_readonly;
--> statement-breakpoint
-- erase_user (0004) as before, now also clearing the saved place (home_postal_code,
-- home_place_name, home_district). CREATE OR REPLACE keeps its owner and grants.
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
