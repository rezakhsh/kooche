-- Retention and account deletion (docs/schema.md, sections 13 and 14).
--
-- listing_events, moderation_decisions and audit_log are append-only for running code, so
-- retention can't delete or scrub them directly. These SECURITY DEFINER functions, owned by
-- classifieds_owner, each do one bounded thing. Only classifieds_worker may call them. The
-- minimum ages are enforced here, so a bug in a job can't wipe recent history.

CREATE FUNCTION purge_audit_log(older_than interval, max_rows integer DEFAULT 10000)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  n bigint;
BEGIN
  IF older_than < interval '2 years' THEN
    RAISE EXCEPTION 'purge_audit_log: audit_log is kept for at least 2 years (got %)', older_than;
  END IF;
  IF max_rows NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION 'purge_audit_log: max_rows must be between 1 and 100000';
  END IF;
  DELETE FROM audit_log
  WHERE id IN (SELECT id FROM audit_log WHERE created_at < now() - older_than ORDER BY id LIMIT max_rows);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;
--> statement-breakpoint

CREATE FUNCTION scrub_audit_ip(older_than interval, max_rows integer DEFAULT 10000)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  n bigint;
BEGIN
  IF older_than < interval '90 days' THEN
    RAISE EXCEPTION 'scrub_audit_ip: IP addresses are kept for at least 90 days (got %)', older_than;
  END IF;
  IF max_rows NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION 'scrub_audit_ip: max_rows must be between 1 and 100000';
  END IF;
  UPDATE audit_log SET ip_address = NULL, user_agent = NULL
  WHERE id IN (
    SELECT id FROM audit_log
    WHERE created_at < now() - older_than AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)
    ORDER BY id LIMIT max_rows);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;
--> statement-breakpoint

-- Reports closed longer ago than older_than, then decisions older than that which nothing
-- references any more (reports, sanctions, listing history, appeals). A decision referenced by
-- a sanction or a listing event stays until that row is gone.
CREATE FUNCTION purge_moderation_records(older_than interval, max_rows integer DEFAULT 10000)
RETURNS TABLE (reports_deleted bigint, decisions_deleted bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF older_than < interval '2 years' THEN
    RAISE EXCEPTION 'purge_moderation_records: kept for at least 2 years (got %)', older_than;
  END IF;
  IF max_rows NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION 'purge_moderation_records: max_rows must be between 1 and 100000';
  END IF;

  DELETE FROM reports
  WHERE id IN (
    SELECT id FROM reports
    WHERE status IN ('resolved', 'dismissed') AND resolved_at < now() - older_than
    ORDER BY id LIMIT max_rows);
  GET DIAGNOSTICS reports_deleted = ROW_COUNT;

  DELETE FROM moderation_decisions
  WHERE id IN (
    SELECT d.id FROM moderation_decisions d
    WHERE d.created_at < now() - older_than
      AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.moderation_decision_id = d.id)
      AND NOT EXISTS (SELECT 1 FROM user_sanctions s WHERE s.moderation_decision_id = d.id)
      AND NOT EXISTS (SELECT 1 FROM listing_events e WHERE e.moderation_decision_id = d.id)
      AND NOT EXISTS (SELECT 1 FROM moderation_decisions a WHERE a.appeal_of_decision_id = d.id)
    ORDER BY d.id LIMIT max_rows);
  GET DIAGNOSTICS decisions_deleted = ROW_COUNT;

  RETURN NEXT;
END
$$;
--> statement-breakpoint

-- Account deletion, in one transaction (section 14):
-- - Refused while the user is the only owner of an organization that isn't deleted.
-- - The user row becomes a tombstone, so every foreign key in moderation and billing stays valid.
-- - Sessions, OAuth accounts, 2FA, favorites, saved searches, memberships, blocks, phone
--   verification attempts, login codes and pending invitations to them are deleted.
-- - Their private listings become deleted (with a listing event and an outbox event each).
--   Listings posted for an organization stay with the organization (section 8).
-- - Their open conversations are closed. Messages stay for 90 days, then the worker purges them.
-- - Billing records stay (10 years, GDPR art. 17(3)(b)).
-- The tombstone's display_name_normalized is normalizePersian('کاربر حذف‌شده'), checked by a test.
CREATE FUNCTION erase_user(p_user_id uuid)
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
--> statement-breakpoint

REVOKE ALL ON FUNCTION
  purge_audit_log(interval, integer), scrub_audit_ip(interval, integer),
  purge_moderation_records(interval, integer), erase_user(uuid)
FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  purge_audit_log(interval, integer), scrub_audit_ip(interval, integer),
  purge_moderation_records(interval, integer), erase_user(uuid)
TO classifieds_worker;
