import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import semver from 'semver';
import { z } from 'zod';
import type { Db, Queryable } from '../../db/drizzle';
import { auditLog, softwareDismissals } from '../../db/schema';

// Keeping our software up to date (owner, Oct 30, 2026; docs/setup.md, "Software updates"). The
// worker compares what we run with the newest versions and the public security warnings, once a
// week and after each start, and writes the result to Valkey for admin › وضعیت سیستم:
// - security fix: a warning affects our version; update within a week, staging and tests first;
// - small fix: a newer version in our line; all of them together on the monthly update day;
// - big new version: only as a planned part, since it can change how things work.
// Nothing is ever updated by itself. Only package names and versions leave the server.
// Sources (public, no keys): the npm registry and its advisory endpoint (what `npm audit` uses) for
// the app's packages, nodejs.org for Node, postgresql.org for PostgreSQL, GitHub releases and
// security advisories for Valkey, Meilisearch, imgproxy and Coolify. Our versions: the lockfile
// (copied into the worker image), Node itself, PostgreSQL and Valkey asked directly, and the
// versions the host script `peydoo-server-versions` writes to SERVER_VERSIONS_KEY every night.

export const SOFTWARE_KEY = 'admin:software';
export const SERVER_VERSIONS_KEY = 'peydoo:server-versions';
/** The check runs weekly; a report older than this means it stopped */
export const SOFTWARE_LATE_MS = 9 * 86_400_000;
const ALERTED_PREFIX = 'software-alerted:';
const ALERTED_TTL_SECONDS = 400 * 86_400;

const NPM = 'https://registry.npmjs.org';
const GITHUB = 'https://api.github.com';

export const SEVERITIES = ['low', 'moderate', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type Group = 'app' | 'server' | 'dev';
export type Kind = 'security' | 'fix' | 'major';
/** A security warning; severity null when the source doesn't rate it (a Node security release) */
export type Advisory = { id: string; title: string; url: string; severity: Severity | null; fixedIn: string | null };
export type SoftwareItem = {
  name: string;
  group: Group;
  kind: Kind;
  ours: string;
  /** The newest version in our line (the small fix), or the first fixed version */
  target: string | null;
  /** A newer line (the big new version) */
  newest: string | null;
  advisories: Advisory[];
  notes: string | null;
};
export type Support = { name: string; line: string; ends: string };
export type SoftwareReport = { at: string; items: SoftwareItem[]; support: Support[]; errors: string[] };

type FetchFn = typeof fetch;

async function getJson<T>(fetchFn: FetchFn, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${new URL(url).host}: ${res.status}`);
  return (await res.json()) as T;
}

const clean = (v: string | null | undefined) => (v ? semver.valid(v.trim().replace(/^v/, '')) : null);

/** Newer than ours: the newest in our line (`^` for npm and Node, `~` for a server's x.y line) and the newest overall */
export function newer(ours: string, versions: string[], line: '^' | '~'): { target: string | null; newest: string | null } {
  const stable = versions.map(clean).filter((v): v is string => !!v && !semver.prerelease(v));
  const inLine = semver.maxSatisfying(stable, `${line}${ours}`);
  const top = semver.maxSatisfying(stable, '*');
  return {
    target: inLine && semver.gt(inLine, ours) ? inLine : null,
    newest: top && semver.gt(top, ours) && top !== inLine ? top : null,
  };
}

export function kindOf(item: Pick<SoftwareItem, 'target' | 'newest' | 'advisories'>): Kind | null {
  if (item.advisories.length) return 'security';
  if (item.target) return 'fix';
  if (item.newest) return 'major';
  return null;
}

// ---------------------------------------------------------------------------------------------
// The app's packages
// ---------------------------------------------------------------------------------------------

type Lockfile = { packages: Record<string, { version?: string; dev?: boolean; devOptional?: boolean; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }> };
export type Installed = {
  direct: Array<{ name: string; version: string; dev: boolean }>;
  /** Every installed package, also the ones that come with others; dev only when every copy is */
  all: Map<string, { versions: Set<string>; dev: boolean }>;
};

export function installedFrom(lock: Lockfile): Installed {
  const all: Installed['all'] = new Map();
  for (const [path, p] of Object.entries(lock.packages)) {
    if (!path || !p.version) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const seen = all.get(name);
    if (seen) {
      seen.versions.add(p.version);
      seen.dev &&= !!(p.dev || p.devOptional);
    } else all.set(name, { versions: new Set([p.version]), dev: !!(p.dev || p.devOptional) });
  }
  const root = lock.packages[''] ?? {};
  const direct = [...Object.keys(root.dependencies ?? {}).map((name) => ({ name, dev: false })), ...Object.keys(root.devDependencies ?? {}).map((name) => ({ name, dev: true }))]
    .map(({ name, dev }) => ({ name, dev, version: lock.packages[`node_modules/${name}`]?.version ?? '' }))
    .filter((p) => p.version);
  return { direct, all };
}

/** The first fixed version of an npm advisory's range for our version (`<x` of the part it falls in) */
export function fixedIn(version: string, range: string): string | null {
  try {
    for (const set of new semver.Range(range).set) {
      if (!set.every((c) => c.test(version))) continue;
      const upper = set.find((c) => c.operator === '<');
      return upper ? upper.semver.version : null;
    }
  } catch {
    // An unreadable range: no fixed version to show
  }
  return null;
}

type NpmAdvisory = { id: number; url: string; title: string; severity: string; vulnerable_versions: string };

async function npmItems(installed: Installed, fetchFn: FetchFn, errors: string[]): Promise<SoftwareItem[]> {
  const items = new Map<string, SoftwareItem>();
  const base = (name: string, ours: string, dev: boolean): SoftwareItem => ({ name, group: dev ? 'dev' : 'app', kind: 'fix', ours, target: null, newest: null, advisories: [], notes: `https://www.npmjs.com/package/${name}?activeTab=versions` });

  // Security: every installed package, like `npm audit`
  try {
    const body: Record<string, string[]> = {};
    for (const [name, p] of installed.all) body[name] = [...p.versions];
    const found = await getJson<Record<string, NpmAdvisory[]>>(fetchFn, `${NPM}/-/npm/v1/security/advisories/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    for (const [name, list] of Object.entries(found)) {
      const p = installed.all.get(name);
      if (!p) continue;
      for (const a of list) {
        const hit = [...p.versions].filter((v) => semver.satisfies(v, a.vulnerable_versions)).sort(semver.compare)[0];
        if (!hit) continue;
        const item = items.get(name) ?? base(name, hit, p.dev);
        if (semver.lt(hit, item.ours)) item.ours = hit;
        const severity = (SEVERITIES as readonly string[]).includes(a.severity) ? (a.severity as Severity) : null;
        item.advisories.push({ id: a.url.split('/').pop() || `npm-${a.id}`, title: a.title, url: a.url, severity, fixedIn: fixedIn(hit, a.vulnerable_versions) });
        items.set(name, item);
      }
    }
  } catch (e) {
    errors.push(`npm advisories: ${(e as Error).message}`);
  }

  // Newer versions: the packages we chose ourselves
  let failed = 0;
  for (const p of installed.direct) {
    try {
      const latest = (await getJson<{ version: string }>(fetchFn, `${NPM}/${p.name.replace('/', '%2F')}/latest`)).version;
      if (!semver.gt(latest, p.version)) continue;
      let found = newer(p.version, [latest], '^');
      if (found.newest) {
        // A new major version is out: the newest of our line needs the whole version list
        const doc = await getJson<{ versions: Record<string, unknown> }>(fetchFn, `${NPM}/${p.name.replace('/', '%2F')}`, { headers: { Accept: 'application/vnd.npm.install-v1+json' } });
        found = newer(p.version, Object.keys(doc.versions), '^');
      }
      const item = items.get(p.name) ?? base(p.name, p.version, p.dev);
      item.target ??= found.target;
      item.newest = found.newest;
      items.set(p.name, item);
    } catch {
      failed++;
    }
  }
  if (failed) errors.push(`npm: ${failed} packages not reached`);

  for (const item of items.values()) {
    item.target ??= item.advisories.map((a) => a.fixedIn).filter((v): v is string => !!v).sort(semver.rcompare)[0] ?? null;
    item.kind = kindOf(item) ?? 'fix';
  }
  return [...items.values()];
}

// ---------------------------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------------------------

type GithubAdvisory = { ghsa_id: string; summary: string; html_url: string; severity: string; vulnerabilities: Array<{ vulnerable_version_range: string | null; patched_versions: string | null }> | null };

/**
 * Does a GitHub repository advisory affect `version`? Projects with several release lines list one
 * fixed version per line («9.1.3, 9.0.7») and one upper bound per line («<= 9.1.2, <= 9.0.6»): ours
 * is affected when it is older than its line's fix; a line not listed wasn't affected. Otherwise the
 * range's comma-separated parts all apply («>= 4.0.0, <= 4.0.15»), and a version past every fix is safe.
 */
export function repoAdvisoryHit(version: string, v: { vulnerable_version_range: string | null; patched_versions: string | null }): { hit: boolean; fixedIn: string | null } {
  const patched = (v.patched_versions ?? '')
    .split(',')
    .map((s) => clean(s.replace(/^\s*[<>=]+\s*/, '')))
    .filter((p): p is string => !!p)
    .sort(semver.compare);
  const line = (p: string) => semver.major(p) === semver.major(version) && semver.minor(p) === semver.minor(version);
  const sameLine = patched.find((p) => line(p) && !semver.prerelease(p));
  if (sameLine) return { hit: semver.lt(version, sameLine), fixedIn: sameLine };
  if (patched.length && patched.every((p) => semver.lte(p, version))) return { hit: false, fixedIn: null };
  try {
    const parts = (v.vulnerable_version_range ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^([<>=]+)\s*v?/, '$1'))
      .filter(Boolean);
    if (!parts.length) return { hit: false, fixedIn: null };
    if (parts.length > 1 && parts.every((p) => p.startsWith('<'))) {
      const bound = parts.find((p) => line(clean(p.replace(/^[<=]+/, '')) ?? '0.0.0'));
      if (!bound || !semver.satisfies(version, bound, { includePrerelease: true })) return { hit: false, fixedIn: null };
    } else if (!semver.satisfies(version, parts.join(' '), { includePrerelease: true })) return { hit: false, fixedIn: null };
    return { hit: true, fixedIn: patched.find((p) => semver.gt(p, version)) ?? null };
  } catch {
    return { hit: false, fixedIn: null };
  }
}

const GITHUB_SERVERS = [
  { name: 'Valkey', repo: 'valkey-io/valkey', from: 'valkey' },
  { name: 'Meilisearch', repo: 'meilisearch/meilisearch', from: 'meilisearch' },
  { name: 'imgproxy', repo: 'imgproxy/imgproxy', from: 'imgproxy' },
  { name: 'Coolify', repo: 'coollabsio/coolify', from: 'coolify' },
] as const;

async function githubItem(name: string, repo: string, ours: string, fetchFn: FetchFn): Promise<SoftwareItem | null> {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'peydoo-worker' };
  const releases = await getJson<Array<{ tag_name: string; draft: boolean; prerelease: boolean }>>(fetchFn, `${GITHUB}/repos/${repo}/releases?per_page=100`, { headers });
  const found = newer(ours, releases.filter((r) => !r.draft && !r.prerelease).map((r) => r.tag_name), '~');
  const published = await getJson<GithubAdvisory[]>(fetchFn, `${GITHUB}/repos/${repo}/security-advisories?per_page=100&state=published`, { headers });
  const advisories: Advisory[] = [];
  for (const a of published) {
    for (const v of a.vulnerabilities ?? []) {
      const r = repoAdvisoryHit(ours, v);
      if (!r.hit) continue;
      const severity = a.severity === 'medium' ? 'moderate' : (SEVERITIES as readonly string[]).includes(a.severity) ? (a.severity as Severity) : null;
      advisories.push({ id: a.ghsa_id, title: a.summary, url: a.html_url, severity, fixedIn: r.fixedIn });
      break;
    }
  }
  const item = { name, group: 'server' as const, ours, ...found, advisories, notes: `https://github.com/${repo}/releases` };
  const kind = kindOf(item);
  if (!kind) return null;
  if (kind === 'security' && !item.target) item.target = advisories.map((a) => a.fixedIn).filter((v): v is string => !!v).sort(semver.rcompare)[0] ?? null;
  return { ...item, kind };
}

type NodeRelease = { version: string; lts: string | false; security: boolean };

async function nodeItem(ours: string, fetchFn: FetchFn, support: Support[]): Promise<SoftwareItem | null> {
  const releases = await getJson<NodeRelease[]>(fetchFn, 'https://nodejs.org/dist/index.json');
  const major = semver.major(ours);
  try {
    const schedule = await getJson<Record<string, { end: string }>>(fetchFn, 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json');
    if (schedule[`v${major}`]) support.push({ name: 'Node.js', line: String(major), ends: schedule[`v${major}`]!.end });
  } catch {
    // The end date is a nice-to-have
  }
  // Only LTS lines: odd majors never get long support
  const found = newer(ours, releases.filter((r) => r.lts || semver.major(clean(r.version) ?? '0.0.0') === major).map((r) => r.version), '^');
  const advisories = releases
    .filter((r) => r.security && clean(r.version) && semver.major(clean(r.version)!) === major && semver.gt(clean(r.version)!, ours))
    .map((r) => clean(r.version)!)
    .sort(semver.compare)
    .slice(0, 1)
    .map((v): Advisory => ({ id: `node-${v}`, title: `Node.js ${v} security release`, url: `https://nodejs.org/en/blog/release/v${v}`, severity: null, fixedIn: v }));
  const item = { name: 'Node.js', group: 'server' as const, ours, ...found, advisories, notes: 'https://nodejs.org/en/blog/release' };
  const kind = kindOf(item);
  return kind ? { ...item, kind } : null;
}

type PgVersion = { major: string; latestMinor: string; eolDate: string; supported: boolean; current: boolean };

async function postgresItem(db: Queryable, fetchFn: FetchFn, support: Support[]): Promise<SoftwareItem | null> {
  const [row] = await db.execute<{ server_version: string }>(sql`SHOW server_version`);
  const m = /^(\d+)\.(\d+)/.exec(row?.server_version ?? '');
  if (!m) throw new Error('unknown server_version');
  const [major, minor] = [Number(m[1]), Number(m[2])];
  const versions = await getJson<PgVersion[]>(fetchFn, 'https://www.postgresql.org/versions.json');
  const ourLine = versions.find((v) => Number(v.major) === major);
  if (ourLine) support.push({ name: 'PostgreSQL', line: String(major), ends: ourLine.eolDate });
  const top = versions.filter((v) => v.supported).sort((a, b) => Number(b.major) - Number(a.major))[0];
  // PostgreSQL's numbers are major.minor: 18.6 → 18.7 is a small fix (they often carry security
  // fixes too, which postgresql.org lists without a feed: so they go with the next update day)
  const item = {
    name: 'PostgreSQL',
    group: 'server' as const,
    ours: `${major}.${minor}`,
    target: ourLine && Number(ourLine.latestMinor) > minor ? `${major}.${ourLine.latestMinor}` : null,
    newest: top && Number(top.major) > major ? `${top.major}.${top.latestMinor}` : null,
    advisories: [],
    notes: ourLine && Number(ourLine.latestMinor) > minor ? `https://www.postgresql.org/docs/release/${major}.${ourLine.latestMinor}/` : 'https://www.postgresql.org/docs/release/',
  };
  const kind = kindOf(item);
  return kind ? { ...item, kind } : null;
}

// ---------------------------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------------------------

export type CheckOptions = {
  /** The lockfile the worker was built with */
  lockfile?: string;
  nodeVersion?: string;
  fetchFn?: FetchFn;
  now?: Date;
};

const KIND_ORDER: Record<Kind, number> = { security: 0, fix: 1, major: 2 };
const GROUP_ORDER: Record<Group, number> = { server: 0, app: 1, dev: 2 };

export async function checkSoftware(db: Queryable, redis: Redis, opts: CheckOptions = {}): Promise<SoftwareReport> {
  const fetchFn = opts.fetchFn ?? fetch;
  const errors: string[] = [];
  const support: Support[] = [];
  const items: SoftwareItem[] = [];
  const attempt = async (label: string, run: () => Promise<SoftwareItem | SoftwareItem[] | null>) => {
    try {
      const r = await run();
      if (Array.isArray(r)) items.push(...r);
      else if (r) items.push(r);
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message}`);
    }
  };

  await attempt('npm', async () => npmItems(installedFrom(JSON.parse(await readFile(opts.lockfile ?? 'package-lock.json', 'utf8')) as Lockfile), fetchFn, errors));
  await attempt('Node.js', () => nodeItem(clean(opts.nodeVersion ?? process.version)!, fetchFn, support));
  await attempt('PostgreSQL', () => postgresItem(db, fetchFn, support));

  const hostVersions = await redis.get(SERVER_VERSIONS_KEY).then((v) => (v ? (JSON.parse(v) as Record<string, string>) : {}), () => ({}) as Record<string, string>);
  const valkey = /(?:valkey|redis)_version:([\d.]+)/.exec(await redis.info('server').catch(() => ''))?.[1];
  for (const s of GITHUB_SERVERS) {
    const ours = clean(s.from === 'valkey' ? valkey : hostVersions[s.from]);
    if (!ours) {
      errors.push(`${s.name}: version unknown`);
      continue;
    }
    await attempt(s.name, () => githubItem(s.name, s.repo, ours, fetchFn));
  }

  items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || a.name.localeCompare(b.name));
  return { at: (opts.now ?? new Date()).toISOString(), items, support, errors };
}

export async function writeSoftwareReport(redis: Redis, report: SoftwareReport): Promise<void> {
  await redis.set(SOFTWARE_KEY, JSON.stringify(report));
}

export async function readSoftwareReport(redis: Redis): Promise<SoftwareReport | null> {
  const raw = await redis.get(SOFTWARE_KEY);
  return raw ? (JSON.parse(raw) as SoftwareReport) : null;
}

/**
 * The security fixes the owner hasn't been told about: each warning once (a claim in Valkey for 400
 * days). Developer tools never reach the live site, so they never alert. `release` gives the claims
 * back when the message couldn't be sent.
 */
export async function claimNewWarnings(redis: Redis, items: SoftwareItem[]): Promise<{ items: SoftwareItem[]; release: () => Promise<void> }> {
  const claimed: string[] = [];
  const out: SoftwareItem[] = [];
  for (const item of items) {
    if (item.kind !== 'security' || item.group === 'dev') continue;
    let fresh = false;
    for (const a of item.advisories) {
      const key = `${ALERTED_PREFIX}${item.name}:${a.id}`;
      if ((await redis.set(key, '1', 'EX', ALERTED_TTL_SECONDS, 'NX')) === 'OK') {
        claimed.push(key);
        fresh = true;
      }
    }
    if (fresh) out.push(item);
  }
  return { items: out, release: async () => void (claimed.length && (await redis.del(...claimed))) };
}

// ---------------------------------------------------------------------------------------------
// «لازم نیست»
// ---------------------------------------------------------------------------------------------

/** What a mark covers: the package, the version on offer and its warnings; anything new brings it back */
export function dismissKey(item: SoftwareItem): string {
  const ids = item.advisories.map((a) => a.id).sort();
  return `${item.name}@${item.target ?? item.newest ?? item.ours}${ids.length ? `+${ids.join(',')}` : ''}`.slice(0, 600);
}

const dismissInput = z.object({
  key: z.string().min(3).max(600),
  name: z.string().min(1).max(214),
  reason: z.string().trim().min(3).max(300),
});

export async function dismissSoftware(db: Db, staff: { userId: string }, input: unknown): Promise<'ok' | 'invalid'> {
  const parsed = dismissInput.safeParse(input);
  if (!parsed.success) return 'invalid';
  await db.transaction(async (tx) => {
    const added = await tx.insert(softwareDismissals).values({ ...parsed.data, userId: staff.userId }).onConflictDoNothing().returning({ id: softwareDismissals.id });
    if (added.length) await tx.insert(auditLog).values({ actorType: 'staff', actorUserId: staff.userId, action: 'system.software_dismissed', targetType: 'software_dismissal', targetId: added[0]!.id, data: parsed.data });
  });
  return 'ok';
}

export type Dismissal = { reason: string; at: Date; by: string | null };

export async function listDismissals(db: Queryable): Promise<Map<string, Dismissal>> {
  const rows = await db.execute<{ key: string; reason: string; created_at: string | Date; email: string | null }>(sql`
    SELECT d.key, d.reason, d.created_at, u.email FROM software_dismissals d LEFT JOIN users u ON u.id = d.user_id`);
  return new Map(rows.map((r) => [r.key, { reason: r.reason, at: new Date(r.created_at), by: r.email }]));
}

/** Security fixes for the live site that nobody marked «لازم نیست»: the red problem on the admin page */
export function openSecurityFixes(report: SoftwareReport | null, dismissed: Map<string, Dismissal>): number {
  return (report?.items ?? []).filter((i) => i.kind === 'security' && i.group !== 'dev' && !dismissed.has(dismissKey(i))).length;
}
