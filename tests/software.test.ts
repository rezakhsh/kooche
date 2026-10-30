import { createHmac, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Queue, QueueEvents } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { SIGNATURE_HEADER, softwarePayload } from '../src/modules/admin/alert';
import { systemProblems } from '../src/modules/admin/attention';
import {
  checkSoftware,
  claimNewWarnings,
  dismissKey,
  dismissSoftware,
  fixedIn,
  installedFrom,
  listDismissals,
  newer,
  openSecurityFixes,
  readSoftwareReport,
  repoAdvisoryHit,
  SERVER_VERSIONS_KEY,
  SOFTWARE_KEY,
  type SoftwareItem,
  type SoftwareReport,
  valkeyVersion,
} from '../src/modules/admin/software';
import { startModerationJobs } from '../src/worker/moderation';
import { appDb, redis, workerDb } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE, rollback, setRole } from './db';
import { user } from './listings-fixtures';

// Keeping our software up to date (owner, Oct 30, 2026): the weekly check, the three kinds, the
// owner's Telegram alert once per warning, and «لازم نیست».

describe('what kind of update', () => {
  it('a newer version in our line is a small fix; a newer line is a big new version', () => {
    expect(newer('16.4.2', ['16.4.3', '16.4.2'], '^')).toEqual({ target: '16.4.3', newest: null });
    expect(newer('3.4.9', ['3.4.9', '3.4.10', '4.0.0', '4.0.1', '5.0.0-rc.1'], '^')).toEqual({ target: '3.4.10', newest: '4.0.1' });
    expect(newer('0.1.1', ['0.1.2', '0.2.0'], '^')).toEqual({ target: '0.1.2', newest: '0.2.0' });
    // Servers stay in their x.y line: Meilisearch 1.54 → 1.56 is planned work
    expect(newer('1.54.3', ['v1.56.0', 'v1.54.3'], '~')).toEqual({ target: null, newest: '1.56.0' });
    expect(newer('4.0.16', ['v4.0.20', 'v4.0.17'], '~')).toEqual({ target: '4.0.20', newest: null });
    expect(newer('9.0.6', ['9.0.6'], '~')).toEqual({ target: null, newest: null });
  });

  it('where a security warning is fixed', () => {
    expect(fixedIn('10.0.16', '>=3.0.0 <10.1.4')).toBe('10.1.4');
    expect(fixedIn('1.2.0', '<1.0.5 || >=1.1.0 <1.2.3')).toBe('1.2.3');
    expect(fixedIn('0.18.20', '<=0.24.2')).toBeNull();
    // Valkey lists one fix per release line
    const valkey = { vulnerable_version_range: '<= 9.2.0-rc1, <= 9.1.2, <= 9.0.6, <= 8.1.10', patched_versions: '9.2.0-rc2, 9.1.3, 9.0.7, 8.1.11' };
    expect(repoAdvisoryHit('9.0.6', valkey)).toEqual({ hit: true, fixedIn: '9.0.7' });
    expect(repoAdvisoryHit('9.0.7', valkey)).toEqual({ hit: false, fixedIn: '9.0.7' });
    expect(repoAdvisoryHit('9.1.3', valkey).hit).toBe(false);
    // A line the warning doesn't list wasn't affected
    expect(repoAdvisoryHit('7.2.4', { vulnerable_version_range: '<= 9.1.1, <= 9.0.5, <= 8.1.9', patched_versions: '9.1.2, 9.0.6, 8.1.10' }).hit).toBe(false);
    // Fixed long ago (GitHub's own spelling: «>= v4.0.0-beta.253 »)
    expect(repoAdvisoryHit('4.5.3', { vulnerable_version_range: '>= 4.0.0-beta.18', patched_versions: '>= v4.0.0-beta.253 ' }).hit).toBe(false);
    // imgproxy: one range
    expect(repoAdvisoryHit('4.0.16', { vulnerable_version_range: '>= 3.3.0, <= 4.0.16', patched_versions: '>= 4.0.17' })).toEqual({ hit: true, fixedIn: '4.0.17' });
    expect(repoAdvisoryHit('4.0.16', { vulnerable_version_range: '>= 4.0.0, <= 4.0.15', patched_versions: '>= 4.0.16' }).hit).toBe(false);
    // Coolify's old beta warnings don't touch 4.5
    expect(repoAdvisoryHit('4.5.0', { vulnerable_version_range: '<= 4.0.0-beta.473', patched_versions: 'v4.0.0-beta.474' }).hit).toBe(false);
  });

  it('Valkey’s own version, not the one it reports for old Redis clients', () => {
    expect(valkeyVersion('# Server\r\nredis_version:7.2.4\r\nserver_name:valkey\r\nvalkey_version:9.0.6\r\n')).toBe('9.0.6');
    expect(valkeyVersion('redis_version:7.2.4\r\n')).toBe('7.2.4');
  });

  it('the lockfile: our own packages, and every package with whether it is a developer tool', () => {
    const i = installedFrom(LOCK);
    expect(i.direct).toEqual(expect.arrayContaining([{ name: 'nodemailer', version: '10.0.16', dev: false }, { name: 'esbuild', version: '0.25.0', dev: true }]));
    expect(i.all.get('esbuild')).toEqual({ versions: new Set(['0.25.0', '0.18.20']), dev: true });
    expect(i.all.get('thing')?.dev).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// The whole check against made-up sources
// ---------------------------------------------------------------------------------------------

const LOCK = {
  packages: {
    '': { dependencies: { nodemailer: '10.0.16', next: '16.4.2', postgres: '3.4.9' }, devDependencies: { esbuild: '0.25.0' } },
    'node_modules/nodemailer': { version: '10.0.16' },
    'node_modules/next': { version: '16.4.2' },
    'node_modules/postgres': { version: '3.4.9' },
    'node_modules/thing': { version: '1.0.0' },
    'node_modules/esbuild': { version: '0.25.0', dev: true },
    'node_modules/drizzle-kit/node_modules/esbuild': { version: '0.18.20', devOptional: true },
  },
};
const N8N = 'https://n8n.example.test/webhook/admin';
const APP = 'https://app.example.test';

let pg = { major: 18, minor: 0 };
let valkey = '0.0.0';
const bump = (v: string, part: 'patch' | 'minor') => {
  const [a, b, c] = v.split('.').map(Number) as [number, number, number];
  return part === 'patch' ? `${a}.${b}.${c + 1}` : `${a}.${b + 1}.0`;
};

function sources(calls: Array<{ url: string; body: string; headers: Record<string, string> }>, down: string[] = []) {
  const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
  return (async (input: string, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, body: String(init.body ?? ''), headers: (init.headers ?? {}) as Record<string, string> });
    if (down.some((d) => url.includes(d))) return new Response('no', { status: 503 });
    if (url === N8N) return json({ ok: true });
    if (url.endsWith('/-/npm/v1/security/advisories/bulk'))
      return json({
        nodemailer: [{ id: 1, url: 'https://github.com/advisories/GHSA-m943-m63m-w62w', title: 'Nodemailer addressparser', severity: 'moderate', vulnerable_versions: '>=3.0.0 <10.1.4' }],
        esbuild: [{ id: 2, url: 'https://github.com/advisories/GHSA-67mh-4wv8-2f99', title: 'esbuild dev server', severity: 'moderate', vulnerable_versions: '<=0.24.2' }],
        thing: [{ id: 3, url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz', title: 'old thing', severity: 'high', vulnerable_versions: '<1.0.0' }],
      });
    const latest: Record<string, string> = { nodemailer: '10.3.1', next: '16.4.3', postgres: '4.0.1', esbuild: '0.25.0' };
    const m = /registry\.npmjs\.org\/([^/]+)\/latest$/.exec(url);
    if (m) return latest[m[1]!] ? json({ version: latest[m[1]!] }) : new Response('{}', { status: 404 });
    if (url.endsWith('registry.npmjs.org/postgres')) return json({ versions: { '3.4.9': {}, '3.4.10': {}, '4.0.0': {}, '4.0.1': {} } });
    if (url === 'https://nodejs.org/dist/index.json')
      return json([
        { version: 'v26.1.0', lts: 'Next', security: false },
        { version: 'v25.3.0', lts: false, security: false },
        { version: 'v24.22.2', lts: 'Krypton', security: false },
        { version: 'v24.22.1', lts: 'Krypton', security: true },
        { version: 'v24.22.0', lts: 'Krypton', security: false },
      ]);
    if (url.endsWith('nodejs/Release/main/schedule.json')) return json({ v24: { end: '2028-04-30' } });
    if (url === 'https://www.postgresql.org/versions.json')
      return json([
        { major: String(pg.major), latestMinor: String(pg.minor + 1), eolDate: '2030-11-14', supported: true, current: true },
        { major: String(pg.major - 1), latestMinor: '10', eolDate: '2029-11-08', supported: true, current: false },
      ]);
    if (url.includes('/repos/imgproxy/imgproxy/releases')) return json([{ tag_name: 'v5.0.0-rc1', draft: false, prerelease: true }, { tag_name: 'v4.0.20', draft: false, prerelease: false }, { tag_name: 'v4.0.16', draft: false, prerelease: false }]);
    if (url.includes('/repos/imgproxy/imgproxy/security-advisories'))
      return json([
        { ghsa_id: 'GHSA-494m-4556-wf5p', summary: 'imgproxy SSRF', html_url: 'https://github.com/imgproxy/imgproxy/security/advisories/GHSA-494m-4556-wf5p', severity: 'high', vulnerabilities: [{ vulnerable_version_range: '>= 3.3.0, <= 4.0.16', patched_versions: '>= 4.0.17' }] },
        { ghsa_id: 'GHSA-hff9-5pqw-6w9f', summary: 'older', html_url: 'https://github.com/x', severity: 'critical', vulnerabilities: [{ vulnerable_version_range: '>= 4.0.0, <= 4.0.15', patched_versions: '>= 4.0.16' }] },
      ]);
    if (url.includes('/repos/meilisearch/meilisearch/releases')) return json([{ tag_name: 'v1.56.0', draft: false, prerelease: false }, { tag_name: 'v1.54.3', draft: false, prerelease: false }]);
    if (url.includes('/repos/meilisearch/meilisearch/security-advisories')) return json([]);
    if (url.includes('/repos/valkey-io/valkey/releases')) return json([{ tag_name: bump(valkey, 'minor'), draft: false, prerelease: false }, { tag_name: bump(valkey, 'patch'), draft: false, prerelease: false }]);
    if (url.includes('/repos/valkey-io/valkey/security-advisories'))
      return json([{ ghsa_id: 'GHSA-f4q9-j22m-xqq9', summary: 'Valkey crash', html_url: 'https://github.com/valkey-io/valkey/security/advisories/GHSA-f4q9-j22m-xqq9', severity: 'medium', vulnerabilities: [{ vulnerable_version_range: `<= ${valkey}`, patched_versions: `${bump(valkey, 'patch')}, 99.0.1` }] }]);
    return new Response('not here', { status: 404 });
  }) as unknown as typeof fetch;
}

let lockfile = '';
beforeAll(async () => {
  lockfile = join(tmpdir(), `lock-${randomUUID()}.json`);
  await writeFile(lockfile, JSON.stringify(LOCK));
  const [row] = await db.execute<{ server_version: string }>(sql`SHOW server_version`);
  const m = /^(\d+)\.(\d+)/.exec(row!.server_version)!;
  pg = { major: Number(m[1]), minor: Number(m[2]) };
  valkey = valkeyVersion(await redis.info('server'))!;
});

beforeEach(async () => {
  await redis.flushdb();
  await redis.set(SERVER_VERSIONS_KEY, JSON.stringify({ imgproxy: '4.0.16', meilisearch: '1.54.3' }));
});

const find = (r: SoftwareReport, name: string) => r.items.find((i) => i.name === name);

describe('the weekly check', () => {
  it('sorts every update into security fix, small fix or big new version', async () => {
    const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
    const r = await checkSoftware(workerDb, redis, { lockfile, nodeVersion: 'v24.22.0', fetchFn: sources(calls) });

    expect(find(r, 'nodemailer')).toMatchObject({ group: 'app', kind: 'security', ours: '10.0.16', target: '10.3.1', advisories: [{ id: 'GHSA-m943-m63m-w62w', severity: 'moderate', fixedIn: '10.1.4' }] });
    expect(find(r, 'next')).toMatchObject({ kind: 'fix', ours: '16.4.2', target: '16.4.3', newest: null });
    expect(find(r, 'postgres')).toMatchObject({ kind: 'fix', target: '3.4.10', newest: '4.0.1' });
    // The old esbuild inside drizzle-kit: a developer tool, never on the site
    expect(find(r, 'esbuild')).toMatchObject({ group: 'dev', kind: 'security', ours: '0.18.20' });
    expect(find(r, 'thing')).toBeUndefined();

    expect(find(r, 'Node.js')).toMatchObject({ group: 'server', kind: 'security', ours: '24.22.0', target: '24.22.2', newest: '26.1.0', advisories: [{ id: 'node-24.22.1', severity: null }] });
    expect(find(r, 'PostgreSQL')).toMatchObject({ kind: 'fix', ours: `${pg.major}.${pg.minor}`, target: `${pg.major}.${pg.minor + 1}` });
    expect(find(r, 'imgproxy')).toMatchObject({ kind: 'security', ours: '4.0.16', target: '4.0.20', advisories: [{ id: 'GHSA-494m-4556-wf5p', severity: 'high', fixedIn: '4.0.17' }] });
    expect(find(r, 'Meilisearch')).toMatchObject({ kind: 'major', target: null, newest: '1.56.0' });
    expect(find(r, 'Valkey')).toMatchObject({ kind: 'security', ours: valkey, target: bump(valkey, 'patch'), advisories: [{ severity: 'moderate' }] });
    expect(r.support).toEqual(expect.arrayContaining([{ name: 'Node.js', line: '24', ends: '2028-04-30' }, { name: 'PostgreSQL', line: String(pg.major), ends: '2030-11-14' }]));
    // Coolify's version comes from the host script, which this server doesn't have
    expect(r.errors).toEqual(['Coolify: version unknown']);

    // Most urgent first: security fixes, servers before the app, developer tools last
    expect(r.items.map((i) => i.kind)).toEqual([...r.items.map((i) => i.kind)].sort((a, b) => ['security', 'fix', 'major'].indexOf(a) - ['security', 'fix', 'major'].indexOf(b)));
    expect(r.items.findIndex((i) => i.name === 'esbuild')).toBeGreaterThan(r.items.findIndex((i) => i.name === 'nodemailer'));
    // Only names and versions leave the server
    const sent = calls.map((c) => c.body).join('\n');
    expect(sent).not.toMatch(/@|secret|password/i);
  });

  it('a source that is down is noted, the rest still reported', async () => {
    const r = await checkSoftware(workerDb, redis, { lockfile, nodeVersion: 'v24.22.0', fetchFn: sources([], ['api.github.com', 'nodejs.org']) });
    expect(find(r, 'nodemailer')?.kind).toBe('security');
    expect(find(r, 'imgproxy')).toBeUndefined();
    expect(r.errors).toEqual(expect.arrayContaining(['Node.js: nodejs.org: 503', 'imgproxy: api.github.com: 503']));
  });
});

describe('the owner’s alert', () => {
  const item = (over: Partial<SoftwareItem>): SoftwareItem => ({ name: 'x', group: 'app', kind: 'security', ours: '1.0.0', target: '1.0.1', newest: null, advisories: [{ id: 'GHSA-1', title: 't', url: 'u', severity: 'high', fixedIn: '1.0.1' }], notes: null, ...over });

  it('each warning once; developer tools and small fixes never', async () => {
    const items = [item({ name: 'a' }), item({ name: 'dev', group: 'dev' }), item({ name: 'small', kind: 'fix', advisories: [] })];
    const first = await claimNewWarnings(redis, items);
    expect(first.items.map((i) => i.name)).toEqual(['a']);
    expect((await claimNewWarnings(redis, items)).items).toEqual([]);
    // A second warning for the same package is news
    expect((await claimNewWarnings(redis, [item({ name: 'a', advisories: [...items[0]!.advisories, { id: 'GHSA-2', title: 't', url: 'u', severity: 'low', fixedIn: null }] })])).items).toHaveLength(1);
    // Not sent: told again next time
    const b = await claimNewWarnings(redis, [item({ name: 'b' })]);
    await b.release();
    expect((await claimNewWarnings(redis, [item({ name: 'b' })])).items).toHaveLength(1);
  });

  it('the message: versions and how serious, a link to the card', () => {
    const p = softwarePayload([item({ name: 'nodemailer', ours: '10.0.16', target: '10.3.1', advisories: [{ id: 'a', title: '', url: '', severity: 'moderate', fixedIn: null }, { id: 'b', title: '', url: '', severity: 'high', fixedIn: null }] })], APP, 'secretadminpath0123');
    expect(p).toMatchObject({ kind: 'software_updates', count: 1, url: `${APP}/secretadminpath0123/system#software` });
    expect(p.text).toContain('nodemailer 10.0.16 → 10.3.1 (زیاد)');
  });

  it('the worker job: writes the report, alerts n8n once, and again only for something new', async () => {
    const prefix = `test-${randomUUID()}`;
    const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
    const bull = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const email = new Queue('email-send', { connection: redis, prefix });
    const telegram = new Queue('telegram-send', { connection: redis, prefix });
    const jobs = await startModerationJobs(workerDb, bull, {
      appUrl: APP,
      adminPath: 'secretadminpath0123',
      send: { email, telegram },
      alert: { url: N8N, secret: 'a'.repeat(40) },
      purge: null,
      seo: null,
      fetchFn: sources(calls),
      prefix,
      software: { lockfile, nodeVersion: 'v24.22.0' },
    });
    const events = new QueueEvents('moderation', { connection: bull.duplicate(), prefix });
    try {
      await events.waitUntilReady();
      // The check after each start waits a few minutes
      expect((await jobs.queue.getJobs(['delayed'])).some((j) => j.name === 'software_check')).toBe(true);
      const run = async () => (await jobs.queue.add('software_check', {})).waitUntilFinished(events, 30_000);
      expect(await run()).toMatchObject({ alerted: 4 });
      expect((await readSoftwareReport(redis))?.items.length).toBeGreaterThan(5);
      const sent = calls.filter((c) => c.url === N8N);
      expect(sent).toHaveLength(1);
      const t = sent[0]!.headers[SIGNATURE_HEADER]!.match(/^t=(\d+),v1=([0-9a-f]{64})$/)!;
      expect(t[2]).toBe(createHmac('sha256', 'a'.repeat(40)).update(`${t[1]}.${sent[0]!.body}`).digest('hex'));
      const body = JSON.parse(sent[0]!.body);
      expect(body.kind).toBe('software_updates');
      expect(body.text).not.toContain('esbuild');
      expect(await run()).toMatchObject({ alerted: 0 });
      expect(calls.filter((c) => c.url === N8N)).toHaveLength(1);
    } finally {
      await events.close();
      await jobs.close();
      await Promise.all([email.close(), telegram.close()]);
      await bull.quit();
    }
  });
});

describe('«لازم نیست»', () => {
  it('hides an update until a newer version or another warning; written to the audit log', async () => {
    const staff = await user();
    const r = await checkSoftware(workerDb, redis, { lockfile, nodeVersion: 'v24.22.0', fetchFn: sources([]) });
    // nodemailer, Node.js, imgproxy, Valkey: the dev tool doesn't count
    expect(openSecurityFixes(r, new Map())).toBe(4);
    const node = find(r, 'Node.js')!;
    expect(await dismissSoftware(appDb, { userId: staff.id }, { key: dismissKey(node), name: node.name, reason: 'x' })).toBe('invalid');
    expect(await dismissSoftware(appDb, { userId: staff.id }, { key: dismissKey(node), name: node.name, reason: 'We update Node with the image anyway' })).toBe('ok');
    const dismissed = await listDismissals(appDb);
    expect(dismissed.get(dismissKey(node))).toMatchObject({ reason: 'We update Node with the image anyway', by: staff.email });
    expect(openSecurityFixes(r, dismissed)).toBe(3);
    const [audit] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.actorUserId, staff.id));
    expect(audit).toMatchObject({ action: 'system.software_dismissed', targetType: 'software_dismissal' });
    // A newer version brings it back
    expect(dismissed.has(dismissKey({ ...node, target: '24.22.3' }))).toBe(false);
    // The admin page's red problem
    expect(systemProblems({ database: 1, valkey: 1, meili: undefined }, { snapshot: null, backupAt: null, securityFixes: 3 }, 300).find((p) => p.key === 'updates')).toEqual({ key: 'updates', count: 3 });
    expect(await redis.get(SOFTWARE_KEY)).toBeNull();
  });

  it('the app writes marks but never removes them', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_app');
      await expectError(tx.execute(sql`DELETE FROM software_dismissals`), INSUFFICIENT_PRIVILEGE);
    });
  });
});

afterAll(async () => {
  await redis.flushdb();
});
