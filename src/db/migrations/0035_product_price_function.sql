-- Admin › prices (wave 2 part 7, owner Oct 30, 2026; src/modules/payments/prices.ts). products
-- and product_prices stay read-only for running code. This SECURITY DEFINER function, owned by
-- classifieds_owner, does the one change admin may make: a product's price in one currency and
-- interval becomes another. The active row is retired and a new one added (prices are never
-- edited: orders keep pointing at what was charged); a provider price used before is switched
-- on again instead of a second row. Only classifieds_app may call it.

CREATE FUNCTION set_product_price(p_product_id uuid, p_currency text, p_interval text, p_amount_minor bigint, p_provider text, p_provider_price_id text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  price_id uuid;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor NOT BETWEEN 1 AND 10000000 THEN
    RAISE EXCEPTION 'set_product_price: amount % is out of range', p_amount_minor;
  END IF;
  PERFORM 1 FROM products WHERE id = p_product_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'set_product_price: no active product %', p_product_id;
  END IF;
  UPDATE product_prices SET is_active = false
  WHERE product_id = p_product_id AND currency = p_currency AND interval IS NOT DISTINCT FROM p_interval AND is_active;
  UPDATE product_prices SET is_active = true
  WHERE provider = p_provider AND provider_price_id = p_provider_price_id
    AND product_id = p_product_id AND currency = p_currency AND interval IS NOT DISTINCT FROM p_interval AND amount_minor = p_amount_minor
  RETURNING id INTO price_id;
  IF price_id IS NULL THEN
    INSERT INTO product_prices (product_id, currency, amount_minor, interval, provider, provider_price_id)
    VALUES (p_product_id, p_currency, p_amount_minor, p_interval, p_provider, p_provider_price_id)
    RETURNING id INTO price_id;
  END IF;
  RETURN price_id;
END
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION set_product_price(uuid, text, text, bigint, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION set_product_price(uuid, text, text, bigint, text, text) TO classifieds_app;
