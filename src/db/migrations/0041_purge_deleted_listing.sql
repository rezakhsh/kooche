-- Check B (Oct 31, 2026): a deleted listing is purged after 12 months even when it had a chat or a
-- moderation decision (privacy policy section 9). Before, a chat kept the listing for good, and a
-- decision and the listing's history rows kept each other for good. Run by the worker
-- (src/modules/listings/purge.ts) for each due listing: it goes with its chats and with its
-- decisions once they are past their own 2 years. Anything still evidence (a report, an order, an
-- entitlement, a decision under 2 years or tied to a report, sanction or appeal, a reported or
-- decided message) keeps it, and the function returns NULL. Otherwise it returns the photos'
-- storage keys, for the worker to delete.
CREATE FUNCTION purge_deleted_listing(p_listing_id uuid, older_than interval DEFAULT interval '2 years')
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_keys text[];
BEGIN
  IF older_than < interval '2 years' THEN
    RAISE EXCEPTION 'purge_deleted_listing: decisions are kept for at least 2 years (got %)', older_than;
  END IF;
  PERFORM 1 FROM listings WHERE id = p_listing_id AND status = 'deleted' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM reports r WHERE r.listing_id = p_listing_id)
     OR EXISTS (SELECT 1 FROM orders o WHERE o.listing_id = p_listing_id)
     OR EXISTS (SELECT 1 FROM entitlements e WHERE e.listing_id = p_listing_id)
     OR EXISTS (
       SELECT 1 FROM moderation_decisions d
       WHERE (d.listing_id = p_listing_id OR d.listing_image_id IN (SELECT id FROM listing_images WHERE listing_id = p_listing_id))
         AND (d.created_at >= now() - older_than
              OR EXISTS (SELECT 1 FROM reports r WHERE r.moderation_decision_id = d.id)
              OR EXISTS (SELECT 1 FROM user_sanctions s WHERE s.moderation_decision_id = d.id)
              -- an appeal's decision about another item; one about this listing goes with it
              OR EXISTS (SELECT 1 FROM moderation_decisions a WHERE a.appeal_of_decision_id = d.id
                         AND a.listing_id IS DISTINCT FROM p_listing_id)))
     OR EXISTS (
       SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.listing_id = p_listing_id
         AND (EXISTS (SELECT 1 FROM reports r WHERE r.message_id = m.id)
              OR EXISTS (SELECT 1 FROM moderation_decisions d WHERE d.message_id = m.id)))
  THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(array_agg(storage_key), '{}') INTO v_keys FROM listing_images WHERE listing_id = p_listing_id;
  -- The chats about it go with it (their messages cascade)
  DELETE FROM conversations WHERE listing_id = p_listing_id;
  -- Its history rows first: they refer to its decisions
  DELETE FROM listing_events WHERE listing_id = p_listing_id;
  DELETE FROM moderation_decisions
  WHERE listing_id = p_listing_id OR listing_image_id IN (SELECT id FROM listing_images WHERE listing_id = p_listing_id);
  DELETE FROM listings WHERE id = p_listing_id;
  RETURN v_keys;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION purge_deleted_listing(uuid, interval) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION purge_deleted_listing(uuid, interval) TO classifieds_worker;
