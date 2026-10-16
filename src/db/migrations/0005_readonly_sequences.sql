-- classifieds_readonly runs the nightly pg_dump, which reads every sequence's state.
-- Migration 0003 granted SELECT on tables only, so pg_dump failed on
-- drizzle.__drizzle_migrations_id_seq. Primary keys are UUIDv7, so public has no sequences today.
-- A migration that adds one must grant SELECT on it too; tests/grants.test.ts checks every sequence.

GRANT SELECT ON ALL SEQUENCES IN SCHEMA drizzle TO classifieds_readonly;
--> statement-breakpoint
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO classifieds_readonly;
