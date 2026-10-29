import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { memoryStorage } from '../src/modules/media/storage';
import { setVerification } from '../src/modules/organizations/organizations';
import {
  checkVat,
  deleteDecidedDocuments,
  requestDocumentUpload,
  sanctionsRequired,
  sniffDocument,
  submitVerification,
  verificationDocument,
  verificationLevel,
} from '../src/modules/organizations/verification';
import { db } from './db';
import { user } from './listings-fixtures';
import { business } from './payments-fixtures';

// Business verification levels (wave 2 part 4): one document, kept privately and deleted 7 days
// after the decision; VIES for EU VAT numbers; the sanctions check for level 2.

const PDF = Buffer.from('%PDF-1.7\n%test document\n');
const DAY = 86_400_000;
const orgRow = async (id: string) => (await db.select().from(schema.organizations).where(eq(schema.organizations.id, id)))[0]!;

const vies = (body: unknown, ok = true) => (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 503 })) as unknown as typeof fetch;

describe('the document', () => {
  it('only PDF, JPEG or PNG up to 10 MB; its type is read from its bytes', async () => {
    const store = memoryStorage();
    const u = await user();
    expect(await requestDocumentUpload(store, { userId: u.id, contentType: 'application/pdf', size: 1000 })).toMatchObject({ ok: true, key: expect.stringMatching(new RegExp(`^uploads/verification/${u.id}/`)) });
    expect(await requestDocumentUpload(store, { userId: u.id, contentType: 'application/zip', size: 1000 })).toEqual({ ok: false, reason: 'bad_type' });
    expect(await requestDocumentUpload(store, { userId: u.id, contentType: 'image/png', size: 11 * 1024 * 1024 })).toEqual({ ok: false, reason: 'too_large' });
    expect(sniffDocument(PDF)).toBe('application/pdf');
    expect(sniffDocument(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffDocument(Buffer.from('<html>not a pdf'))).toBeNull();
  });

  it('the owner asks: pending, the file under a private key, VIES checked; others and fake files are refused', async () => {
    const store = memoryStorage();
    const { org, ownerId } = await business();
    await db.update(schema.organizations).set({ vatId: `DE${String(Date.now()).slice(-9)}` }).where(eq(schema.organizations.id, org.id));
    const upload = `uploads/verification/${ownerId}/${randomUUID()}`;
    await store.put(upload, PDF, 'application/pdf');

    const stranger = await user();
    expect(await submitVerification(db, store, { userId: stranger.id, organizationId: org.id, uploadKey: upload })).toEqual({ ok: false, reason: 'not_owner' });
    // Another person's upload key
    expect(await submitVerification(db, store, { userId: ownerId, organizationId: org.id, uploadKey: `uploads/verification/${stranger.id}/${randomUUID()}` })).toEqual({ ok: false, reason: 'bad_file' });
    const fake = `uploads/verification/${ownerId}/${randomUUID()}`;
    await store.put(fake, Buffer.from('<script>'), 'application/pdf');
    expect(await submitVerification(db, store, { userId: ownerId, organizationId: org.id, uploadKey: fake })).toEqual({ ok: false, reason: 'bad_file' });

    const r = await submitVerification(db, store, { userId: ownerId, organizationId: org.id, uploadKey: upload, viesUrl: 'https://vies.example.test/check', fetchFn: vies({ valid: true, name: 'Testladen GmbH' }) });
    expect(r).toEqual({ ok: true });
    const o = await orgRow(org.id);
    expect(o).toMatchObject({ verificationStatus: 'pending', vatCheck: { valid: true, name: 'Testladen GmbH' } });
    expect(o.verificationDocumentKey).toMatch(new RegExp(`^verification/${org.id}/`));
    expect(store.objects.has(upload)).toBe(false);
    expect((await verificationDocument(db, store, org.id))?.type).toBe('application/pdf');

    // Verified with the sanctions check: level 2; the document goes 7 days later
    await setVerification(db, { slug: org.slug, status: 'verified', byUserId: null, sanctionsChecked: true });
    const after = await orgRow(org.id);
    expect(verificationLevel(after)).toBe(2);
    expect(after.verificationDocumentDeleteAt!.getTime()).toBeGreaterThan(Date.now() + 6 * DAY);
    expect(await deleteDecidedDocuments(db, store)).toBe(0);
    expect(await deleteDecidedDocuments(db, store, new Date(Date.now() + 8 * DAY))).toBeGreaterThanOrEqual(1);
    expect((await orgRow(org.id)).verificationDocumentKey).toBeNull();
    expect(store.objects.size).toBe(1); // only the fake upload that was refused
    // Taking the badge away takes level 2 with it
    await setVerification(db, { slug: org.slug, status: 'unverified', byUserId: null });
    expect(verificationLevel(await orgRow(org.id))).toBe(0);
  });

  it('only with the Impressum complete', async () => {
    const store = memoryStorage();
    const { org, ownerId } = await business();
    await db.update(schema.organizations).set({ legalName: null }).where(eq(schema.organizations.id, org.id));
    const upload = `uploads/verification/${ownerId}/${randomUUID()}`;
    await store.put(upload, PDF, 'application/pdf');
    expect(await submitVerification(db, store, { userId: ownerId, organizationId: org.id, uploadKey: upload })).toEqual({ ok: false, reason: 'legal_missing' });
  });
});

describe('VIES and level 2', () => {
  it('checks EU numbers only, with the right prefix; a VIES outage is "not checked", not invalid', async () => {
    const seen: string[] = [];
    const record = (async (_url: string, init: RequestInit) => {
      seen.push(String(init.body));
      return new Response(JSON.stringify({ valid: false }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await checkVat('https://vies.example.test', { countryCode: 'GR', vatId: 'EL 094259216' }, record)).toMatchObject({ valid: false });
    expect(JSON.parse(seen[0]!)).toEqual({ countryCode: 'EL', vatNumber: '094259216' });
    expect(await checkVat('https://vies.example.test', { countryCode: 'GB', vatId: 'GB123456789' }, record)).toBeNull();
    expect(await checkVat(undefined, { countryCode: 'DE', vatId: 'DE123456789' }, record)).toBeNull();
    expect(await checkVat('https://vies.example.test', { countryCode: 'DE', vatId: 'DE123456789' }, vies({}, false))).toMatchObject({ valid: null });
  });

  it('Turkey and the risky types need the sanctions check', () => {
    expect(sanctionsRequired({ countryCode: 'TR', businessType: 'food' })).toBe(true);
    expect(sanctionsRequired({ countryCode: 'DE', businessType: 'legal_finance' })).toBe(true);
    expect(sanctionsRequired({ countryCode: 'DE', businessType: 'real_estate' })).toBe(true);
    expect(sanctionsRequired({ countryCode: 'DE', businessType: 'beauty' })).toBe(false);
    expect(verificationLevel({ verificationStatus: 'verified', sanctionsCheckedAt: null })).toBe(1);
    expect(verificationLevel({ verificationStatus: 'pending', sanctionsCheckedAt: null })).toBe(0);
  });
});
