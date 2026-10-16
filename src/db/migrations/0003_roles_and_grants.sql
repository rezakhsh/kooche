-- Database roles and grants (docs/schema.md, section 13).
--
-- Roles are cluster-wide, so they are created only if missing, and NOLOGIN: login passwords are
-- set per environment outside Git (ALTER ROLE classifieds_app LOGIN PASSWORD '...').
-- classifieds_owner (created by src/db/bootstrap/01-classifieds.sh) runs migrations and owns
-- every object. Running code never uses it.
--
-- Every new table needs its grants in the migration that creates it.
-- tests/grants.test.ts checks that every table has grants for all three roles.

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['classifieds_app', 'classifieds_worker', 'classifieds_readonly'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO classifieds_app, classifieds_worker, classifieds_readonly',
    current_database());
END
$$;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO classifieds_app, classifieds_worker, classifieds_readonly;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- classifieds_readonly: pg_dump backups and manual analysis. SELECT only.
-- ---------------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO classifieds_readonly;
--> statement-breakpoint
GRANT USAGE ON SCHEMA drizzle TO classifieds_readonly;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO classifieds_readonly;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Reference data and products: written only by seeds and migrations (as the owner).
-- ---------------------------------------------------------------------------
GRANT SELECT ON
  currencies, countries, locations, categories, category_attributes, category_attribute_options,
  products, product_prices
TO classifieds_app, classifieds_worker;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- User-facing tables
-- ---------------------------------------------------------------------------

-- Soft-deleted: users are never hard-deleted (tombstones). The worker purges deleted listings.
GRANT SELECT, INSERT, UPDATE ON users, listings, organizations TO classifieds_app, classifieds_worker;
--> statement-breakpoint
GRANT DELETE ON listings TO classifieds_worker;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON
  sessions, auth_accounts, verifications, two_factors, user_blocks, favorites, listing_images,
  saved_searches, organization_members, organization_invitations
TO classifieds_app, classifieds_worker;
--> statement-breakpoint

-- Deleted only by the worker's retention jobs (90 days)
GRANT SELECT, INSERT, UPDATE ON phone_verifications, conversations, messages
TO classifieds_app, classifieds_worker;
--> statement-breakpoint
GRANT DELETE ON phone_verifications, conversations, messages TO classifieds_worker;
--> statement-breakpoint

-- Moderation evidence: never deleted by running code (purge_moderation_records() does it)
GRANT SELECT, INSERT, UPDATE ON reports, user_sanctions TO classifieds_app, classifieds_worker;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Append-only: insert and read, never update or delete
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT ON listing_events, moderation_decisions, audit_log
TO classifieds_app, classifieds_worker;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Outbox and webhooks: the app only writes them, the worker processes and deletes them
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT ON outbox_events, webhook_events TO classifieds_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON outbox_events, webhook_events TO classifieds_worker;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Money: only the worker applies webhooks (decision 7)
-- ---------------------------------------------------------------------------

-- The app starts a checkout: a pending order and its Stripe Checkout Session id, nothing more.
GRANT SELECT, INSERT ON orders, billing_customers TO classifieds_app;
--> statement-breakpoint
GRANT UPDATE (provider_checkout_id) ON orders TO classifieds_app;
--> statement-breakpoint
GRANT SELECT ON payments, subscriptions, entitlements TO classifieds_app;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE ON orders, billing_customers, payments, subscriptions
TO classifieds_worker;
--> statement-breakpoint
-- Entitlements are never rewritten: the worker records when a bump was applied, or revokes.
GRANT SELECT, INSERT ON entitlements TO classifieds_worker;
--> statement-breakpoint
GRANT UPDATE (applied_at, revoked_at, revoke_reason) ON entitlements TO classifieds_worker;
