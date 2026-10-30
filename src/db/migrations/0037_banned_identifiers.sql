CREATE TABLE "banned_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"hash" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "banned_identifiers_kind_check" CHECK ("banned_identifiers"."kind" IN ('phone', 'telegram'))
);
--> statement-breakpoint
CREATE TABLE "fingerprint_keys" (
	"id" smallint PRIMARY KEY NOT NULL,
	"key" "bytea" NOT NULL,
	CONSTRAINT "fingerprint_keys_one_check" CHECK ("fingerprint_keys"."id" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "banned_identifiers_kind_hash_key" ON "banned_identifiers" USING btree ("kind","hash");--> statement-breakpoint
CREATE INDEX "banned_identifiers_expires_at_idx" ON "banned_identifiers" USING btree ("expires_at");--> statement-breakpoint

-- Banned people coming back (code check, approved by the owner Oct 30, 2026; docs/setup.md,
-- "Banned numbers"). When a banned person deletes their account, a one-way fingerprint of their
-- phone number and Telegram account is kept for 2 years, so the same number can't verify a new
-- account. The fingerprint is SHA-256 of the value with a random key made here, which no running
-- role can read (the readonly role can, so pg_dump backups stay whole). The web and the worker
-- (the Telegram bot) only call the two functions below.
INSERT INTO fingerprint_keys (id, key)
VALUES (1, sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')));
--> statement-breakpoint

CREATE FUNCTION banned_fingerprint(p_kind text, p_value text)
RETURNS bytea
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT sha256(k.key || convert_to(p_kind || ':' || p_value, 'UTF8')) FROM fingerprint_keys k WHERE k.id = 1
$$;
--> statement-breakpoint

-- The person asked for deletion (src/modules/users/erasure.ts): if a ban is running, their number
-- and Telegram account are kept as fingerprints. Returns how many.
CREATE FUNCTION record_banned_identifiers(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  u record;
  n integer := 0;
BEGIN
  SELECT phone_e164, telegram_user_id INTO u FROM users WHERE id = p_user_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM user_sanctions s WHERE s.user_id = p_user_id AND s.type = 'banned' AND s.revoked_at IS NULL
      AND s.starts_at <= now() AND (s.ends_at IS NULL OR s.ends_at > now())
  ) THEN
    RETURN 0;
  END IF;
  IF u.phone_e164 IS NOT NULL THEN
    INSERT INTO banned_identifiers (kind, hash, expires_at) VALUES ('phone', banned_fingerprint('phone', u.phone_e164), now() + interval '2 years')
    ON CONFLICT (kind, hash) DO UPDATE SET expires_at = EXCLUDED.expires_at;
    n := n + 1;
  END IF;
  IF u.telegram_user_id IS NOT NULL THEN
    INSERT INTO banned_identifiers (kind, hash, expires_at) VALUES ('telegram', banned_fingerprint('telegram', u.telegram_user_id::text), now() + interval '2 years')
    ON CONFLICT (kind, hash) DO UPDATE SET expires_at = EXCLUDED.expires_at;
    n := n + 1;
  END IF;
  RETURN n;
END
$$;
--> statement-breakpoint

-- Whether a number (kind 'phone', E.164) or a Telegram account id (kind 'telegram') belongs to a
-- banned person who deleted their account (src/modules/users/phone.ts, completeVerification)
CREATE FUNCTION banned_identifier_hit(p_kind text, p_value text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM banned_identifiers b WHERE b.kind = p_kind AND b.hash = banned_fingerprint(p_kind, p_value) AND b.expires_at > now())
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION banned_fingerprint(text, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION record_banned_identifiers(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION banned_identifier_hit(text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_banned_identifiers(uuid) TO classifieds_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION banned_identifier_hit(text, text) TO classifieds_app, classifieds_worker;
--> statement-breakpoint
GRANT SELECT ON banned_identifiers TO classifieds_app;
--> statement-breakpoint
GRANT SELECT, DELETE ON banned_identifiers TO classifieds_worker;
--> statement-breakpoint
GRANT SELECT ON banned_identifiers, fingerprint_keys TO classifieds_readonly;
