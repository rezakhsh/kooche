import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { entitlements, orders, outboxEvents, listingEvents, listings } from '../src/db/schema';
import {
  INSUFFICIENT_PRIVILEGE,
  db,
  expectError,
  makeListing,
  makeProduct,
  makeUser,
  rollback,
  setRole,
  type Role,
  type Tx,
} from './db';

// Database roles and grants (docs/schema.md, section 13; migration 0003).

const ROLES: Role[] = ['classifieds_app', 'classifieds_worker', 'classifieds_readonly'];

async function tables(): Promise<string[]> {
  const rows = await db.execute(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'spatial_ref_sys' ORDER BY tablename`);
  return (rows as unknown as { tablename: string }[]).map((r) => r.tablename);
}

async function has(role: Role, table: string, privilege: string): Promise<boolean> {
  const rows = await db.execute(
    sql`SELECT has_table_privilege(${role}, ${'public.' + table}, ${privilege}) AS ok`,
  );
  return (rows[0] as { ok: boolean }).ok;
}

/** Runs the statement as `role` inside a savepoint and expects it to be refused */
async function denied(tx: Tx, role: Role, statement: (tx: Tx) => PromiseLike<unknown>) {
  await setRole(tx, role);
  await expectError(tx.transaction(async (sp) => void (await statement(sp))), INSUFFICIENT_PRIVILEGE);
}

describe('grants', () => {
  it('cover every table for all three roles', async () => {
    const all = await tables();
    expect(all).toHaveLength(44);
    const missing: string[] = [];
    for (const table of all) {
      for (const role of ROLES) if (!(await has(role, table, 'SELECT'))) missing.push(`${role} ${table}`);
    }
    expect(missing).toEqual([]);
  });

  it('give the readonly role no write access anywhere', async () => {
    const writable: string[] = [];
    for (const table of await tables()) {
      for (const p of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        if (await has('classifieds_readonly', table, p)) writable.push(`${p} ${table}`);
      }
    }
    expect(writable).toEqual([]);
  });

  it('let the readonly role read every sequence, so pg_dump works (migration 0005)', async () => {
    const rows = await db.execute(sql`
      SELECT n.nspname || '.' || c.relname AS seq
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'drizzle')
        -- CASE, because the planner may evaluate the privilege check before the relkind filter
        AND CASE WHEN c.relkind = 'S'
          THEN NOT has_sequence_privilege('classifieds_readonly', c.oid, 'SELECT') ELSE false END
      ORDER BY 1`);
    expect((rows as unknown as { seq: string }[]).map((r) => r.seq)).toEqual([]);
  });

  it('keep listing_events, moderation_decisions and audit_log append-only', async () => {
    const rewritable: string[] = [];
    for (const table of ['listing_events', 'moderation_decisions', 'audit_log']) {
      for (const role of ['classifieds_app', 'classifieds_worker'] as const) {
        expect(await has(role, table, 'INSERT')).toBe(true);
        for (const p of ['UPDATE', 'DELETE', 'TRUNCATE']) {
          if (await has(role, table, p)) rewritable.push(`${role} ${p} ${table}`);
        }
      }
    }
    expect(rewritable).toEqual([]);

    await rollback(async (tx) => {
      await denied(tx, 'classifieds_worker', (sp) =>
        sp.execute(sql`UPDATE audit_log SET data = '{}' WHERE false`),
      );
      await denied(tx, 'classifieds_worker', (sp) => sp.delete(listingEvents).where(sql`false`));
    });
  });

  it("don't let the app write money tables", async () => {
    for (const table of ['payments', 'subscriptions', 'entitlements']) {
      for (const p of ['INSERT', 'UPDATE', 'DELETE']) {
        expect(await has('classifieds_app', table, p), `${p} ${table}`).toBe(false);
      }
    }
    await rollback(async (tx) => {
      await denied(tx, 'classifieds_app', (sp) =>
        sp.execute(sql`UPDATE payments SET status = 'succeeded' WHERE false`),
      );
    });
  });

  it('let the app start a checkout but never mark an order paid', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx);
      const listing = await makeListing(tx, user.id);
      const { product, price } = await makeProduct(tx);
      await setRole(tx, 'classifieds_app');
      // Only a pending order's columns (migration 0014): plain SQL, since Drizzle names every column
      const [order] = await tx.execute<{ id: string }>(sql`
        INSERT INTO orders (buyer_user_id, product_id, product_price_id, listing_id, currency, subtotal_minor, discount_minor, tax_minor, total_minor)
        VALUES (${user.id}, ${product.id}, ${price.id}, ${listing.id}, 'EUR', 299, 0, 0, 299)
        RETURNING id`);
      await expectError(
        tx.transaction((sp) =>
          sp.execute(sql`INSERT INTO orders (buyer_user_id, product_id, product_price_id, currency, subtotal_minor, discount_minor, tax_minor, total_minor, status, paid_at)
            VALUES (${user.id}, ${product.id}, ${price.id}, 'EUR', 299, 0, 0, 299, 'paid', now())`),
        ),
        INSUFFICIENT_PRIVILEGE,
      );
      await tx
        .update(orders)
        .set({ providerCheckoutId: 'cs_test_123' })
        .where(eq(orders.id, order!.id));
      await expectError(
        tx.transaction((sp) =>
          sp.update(orders).set({ status: 'paid', paidAt: new Date() }).where(eq(orders.id, order!.id)),
        ),
        INSUFFICIENT_PRIVILEGE,
      );

      // The worker applies the webhook
      await setRole(tx, 'classifieds_worker');
      await tx
        .update(orders)
        .set({ status: 'paid', paidAt: new Date() })
        .where(eq(orders.id, order!.id));
    });
  });

  it('let the worker record and revoke entitlements but never rewrite them', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_worker');
      await tx.update(entitlements).set({ appliedAt: new Date() }).where(sql`false`);
      await tx
        .update(entitlements)
        .set({ revokedAt: new Date(), revokeReason: 'refund' })
        .where(sql`false`);
      await expectError(
        tx.transaction((sp) => sp.update(entitlements).set({ startsAt: new Date() }).where(sql`false`)),
        INSUFFICIENT_PRIVILEGE,
      );
      await expectError(
        tx.transaction((sp) => sp.delete(entitlements).where(sql`false`)),
        INSUFFICIENT_PRIVILEGE,
      );
    });
  });

  it('keep reference data and products read-only for running code', async () => {
    for (const role of ['classifieds_app', 'classifieds_worker'] as const) {
      for (const table of ['categories', 'locations', 'countries', 'postal_places', 'products', 'product_prices']) {
        expect(await has(role, table, 'UPDATE'), `${role} UPDATE ${table}`).toBe(false);
        expect(await has(role, table, 'INSERT'), `${role} INSERT ${table}`).toBe(false);
      }
    }
  });

  it('never let running code delete users, and only the worker purge listings', async () => {
    for (const role of ['classifieds_app', 'classifieds_worker'] as const) {
      expect(await has(role, 'users', 'DELETE')).toBe(false);
    }
    expect(await has('classifieds_app', 'listings', 'DELETE')).toBe(false);

    await rollback(async (tx) => {
      const user = await makeUser(tx);
      const listing = await makeListing(tx, user.id, {
        status: 'deleted',
        deletedAt: new Date(),
      });
      await tx.insert(listingEvents).values({
        listingId: listing.id,
        eventType: 'deleted',
        actorType: 'user',
        actorUserId: user.id,
        revision: 1,
      });
      // The purge cascades into the append-only history: FK actions run as the table owner
      await setRole(tx, 'classifieds_worker');
      await tx.delete(listings).where(eq(listings.id, listing.id));
      await tx.execute(sql`RESET ROLE`);
      const left = await tx.select().from(listingEvents).where(eq(listingEvents.listingId, listing.id));
      expect(left).toEqual([]);
    });
  });

  it('let the app write the outbox but only the worker process it', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_app');
      await tx.insert(outboxEvents).values({
        eventType: 'listing.published',
        aggregateType: 'listing',
        aggregateId: '00000000-0000-7000-8000-000000000000',
      });
      await expectError(
        tx.transaction((sp) => sp.update(outboxEvents).set({ processedAt: new Date() }).where(sql`true`)),
        INSUFFICIENT_PRIVILEGE,
      );
      await setRole(tx, 'classifieds_worker');
      await tx.update(outboxEvents).set({ processedAt: new Date() }).where(sql`true`);
      await tx.delete(outboxEvents).where(sql`processed_at IS NOT NULL`);
    });
  });

  it('let only the worker call the retention functions', async () => {
    const rows = await db.execute(sql`
      SELECT p.proname,
             has_function_privilege('classifieds_worker', p.oid, 'EXECUTE') AS worker,
             has_function_privilege('classifieds_app', p.oid, 'EXECUTE') AS app,
             has_function_privilege('classifieds_readonly', p.oid, 'EXECUTE') AS readonly
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      ORDER BY p.proname`);
    expect(rows).toEqual([
      { proname: 'erase_user', worker: true, app: false, readonly: false },
      { proname: 'purge_audit_log', worker: true, app: false, readonly: false },
      { proname: 'purge_moderation_records', worker: true, app: false, readonly: false },
      { proname: 'scrub_audit_ip', worker: true, app: false, readonly: false },
    ]);
  });

  it('let only the three roles connect', async () => {
    const rows = await db.execute(sql`
      SELECT has_database_privilege('public', current_database(), 'CONNECT') AS public_connect,
             has_database_privilege('classifieds_app', current_database(), 'CONNECT') AS app_connect`);
    expect(rows[0]).toEqual({ public_connect: false, app_connect: true });
  });
});
