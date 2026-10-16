-- What drizzle-kit can't declare (docs/schema.md, sections 2, 8, 12 and 13).

-- updated_at is kept current by one trigger function rather than Drizzle's $onUpdate,
-- so raw SQL and scripts can't forget it. Every new table with updated_at needs its trigger
-- here or in a later migration; tests/schema.test.ts checks that none is missing.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'auth_accounts', 'categories', 'category_attribute_options', 'category_attributes',
    'conversations', 'listing_images', 'listings', 'locations', 'orders',
    'organization_invitations', 'organization_members', 'organizations', 'payments',
    'products', 'reports', 'saved_searches', 'sessions', 'subscriptions', 'two_factors',
    'users', 'verifications'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_set_updated_at', t);
  END LOOP;
END
$$;
--> statement-breakpoint

-- Images of a listing in order. Deferrable, so reordering can swap positions in one transaction:
--   SET CONSTRAINTS listing_images_listing_id_position_key DEFERRED;
ALTER TABLE listing_images
  ADD CONSTRAINT listing_images_listing_id_position_key
  UNIQUE (listing_id, position) DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint

-- Exactly one active price per product, currency and interval (interval is null for one-time
-- products, hence NULLS NOT DISTINCT). drizzle-kit's index builder has no NULLS NOT DISTINCT.
CREATE UNIQUE INDEX product_prices_active_key
  ON product_prices (product_id, currency, interval) NULLS NOT DISTINCT
  WHERE is_active;
--> statement-breakpoint

-- Frequent view_count updates (unindexed) can stay on the same page as HOT updates.
ALTER TABLE listings SET (fillfactor = 90);
--> statement-breakpoint

-- Constant inserts and deletes: vacuum early.
ALTER TABLE outbox_events SET (autovacuum_vacuum_scale_factor = 0.01);
