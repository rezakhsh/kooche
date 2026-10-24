import type { Breadcrumb, Event, Exception, StackFrame } from '@sentry/core';
import { isValidIban, luhn } from '../../modules/chat/risk';

// Personal data never leaves our servers in an error report (docs/setup.md, "Error monitoring").
// Every event, from the web server, the worker or a browser through the tunnel, is rebuilt here
// from a short list of known fields; anything else (user, headers, cookies, request body, query
// strings, local variables, extra data that libraries hang on their errors) is dropped. What is
// kept is redacted: emails, phone numbers, IP addresses, IBANs, card numbers and secrets. Persian
// and Arabic digits are folded first, so they can't hide a number. Pure functions, no I/O.

const MAX_TEXT = 2_000;
const MAX_FRAMES = 60;
const MAX_BREADCRUMBS = 30;

/** Persian (۰–۹) and Arabic-Indic (٠–٩) digits → Latin */
function foldDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (c) => String((c.charCodeAt(0) - 0x0660) % 0x90));
}

const DATE = /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})$/;

/** [pattern, replacement]; the order matters (a URL's password before emails, cards before phones) */
const RULES: Array<[RegExp, string | ((match: string, ...groups: string[]) => string)]> = [
  // user:password@ in URLs (database and SMTP URLs in connection errors)
  [/\/\/[^/\s:@]+:[^/\s@]+@/g, '//[secret]@'],
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '[secret]'],
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [secret]'],
  [/\b(?:sk|rk|pk)_(?:test|live)_[0-9A-Za-z]{8,}|\bwhsec_[0-9A-Za-z]{8,}/g, '[secret]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  // UUIDs are our internal ids (users included), never needed to understand an error
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  [
    /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/gi,
    (m) => (isValidIban(m.replace(/ /g, '')) ? '[number]' : m),
  ],
  [/(?<![\w-])\d(?:[ -]?\d){12,18}(?![\w-])/g, (m) => (luhn(m.replace(/\D/g, '')) ? '[number]' : m)],
  [/(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g, '[ip]'],
  [/(?<![\w:])(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(?![\w:])/gi, '[ip]'],
  [/(?<![\w:])(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?(?![\w:])/gi, '[ip]'],
  // Phone numbers: 8 to 15 digits with the usual separators, not inside a word, id or UUID
  [
    /(?<![\w-])(?:\+|00)?\d[\d ()/.-]{6,20}\d(?![\w-])/g,
    (m) => {
      const digits = m.replace(/\D/g, '').length;
      return digits >= 8 && digits <= 15 && !DATE.test(m) ? '[phone]' : m;
    },
  ],
  // Long hex or base64 strings: keys, signatures, one-time link tokens
  [/\b[0-9a-f]{32,}\b/gi, '[secret]'],
  // (without '/', so file paths stay)
  [/(?<![A-Za-z0-9_+=-])(?=[A-Za-z0-9_+=-]*\d)(?=[A-Za-z0-9_+=-]*[A-Za-z])[A-Za-z0-9_+=-]{32,}/g, '[secret]'],
];

/** The text with personal data and secrets replaced, at most 2,000 characters */
export function redact(text: string): string {
  let out = foldDigits(text);
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement as never);
  return out.length > MAX_TEXT ? `${out.slice(0, MAX_TEXT)}…` : out;
}

/** A URL without its query string and fragment, then redacted (path tokens included) */
export function stripUrl(url: string): string {
  return redact(url.replace(/[?#].*$/s, ''));
}

const text = (v: unknown): string | undefined => (typeof v === 'string' ? redact(v) : undefined);

function scrubFrame(f: StackFrame): StackFrame {
  return {
    filename: f.filename === undefined ? undefined : stripUrl(f.filename),
    abs_path: f.abs_path === undefined ? undefined : stripUrl(f.abs_path),
    module: text(f.module),
    function: text(f.function),
    lineno: f.lineno,
    colno: f.colno,
    in_app: f.in_app,
  };
}

function scrubException(e: Exception): Exception {
  const frames = e.stacktrace?.frames;
  return {
    type: text(e.type),
    value: text(e.value),
    mechanism: e.mechanism && {
      type: e.mechanism.type,
      handled: e.mechanism.handled,
      ...(e.mechanism.synthetic !== undefined ? { synthetic: e.mechanism.synthetic } : {}),
      ...(e.mechanism.exception_id !== undefined ? { exception_id: e.mechanism.exception_id } : {}),
      ...(e.mechanism.parent_id !== undefined ? { parent_id: e.mechanism.parent_id } : {}),
      ...(e.mechanism.source !== undefined ? { source: text(e.mechanism.source) } : {}),
    },
    stacktrace: frames && { frames: frames.slice(-MAX_FRAMES).map(scrubFrame) },
  };
}

/** Only navigation breadcrumbs (paths), from browsers; servers send none */
function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (b.category !== 'navigation') return null;
  const from = typeof b.data?.from === 'string' ? stripUrl(b.data.from) : undefined;
  const to = typeof b.data?.to === 'string' ? stripUrl(b.data.to) : undefined;
  return { category: 'navigation', timestamp: b.timestamp, data: { from, to } };
}

/** Context keys worth keeping: versions and names, never ids */
const CONTEXT_KEYS: Record<string, readonly string[]> = {
  browser: ['name', 'version'],
  os: ['name', 'version'],
  device: ['family', 'model'],
  runtime: ['name', 'version'],
  peydoo: ['queue', 'job', 'attempts', 'component'],
};

function scrubContexts(contexts: Event['contexts']): Event['contexts'] {
  if (!contexts) return undefined;
  const out: Record<string, Record<string, unknown>> = {};
  for (const [name, keys] of Object.entries(CONTEXT_KEYS)) {
    const source = contexts[name] as Record<string, unknown> | undefined;
    if (!source) continue;
    const kept: Record<string, unknown> = {};
    for (const key of keys) {
      const v = source[key];
      if (typeof v === 'string') kept[key] = redact(v);
      else if (typeof v === 'number' || typeof v === 'boolean') kept[key] = v;
    }
    if (Object.keys(kept).length) out[name] = kept;
  }
  return Object.keys(out).length ? out : undefined;
}

function scrubTags(tags: Event['tags']): Event['tags'] {
  if (!tags) return undefined;
  const out: NonNullable<Event['tags']> = {};
  for (const [k, v] of Object.entries(tags).slice(0, 30)) {
    if (!/^[a-z_.]{1,32}$/.test(k)) continue;
    out[k] = typeof v === 'string' ? redact(v).slice(0, 200) : typeof v === 'number' || typeof v === 'boolean' ? v : null;
  }
  return out;
}

/** The event rebuilt from known fields only, every text redacted. Not for transactions or other types. */
export function scrubEvent<T extends Event>(event: T): T {
  const breadcrumbs = (event.breadcrumbs ?? [])
    .slice(-MAX_BREADCRUMBS)
    .map(scrubBreadcrumb)
    .filter((b): b is Breadcrumb => b !== null);
  const out: Event = {
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: event.level,
    platform: event.platform,
    logger: text(event.logger),
    release: text(event.release),
    environment: text(event.environment),
    sdk: event.sdk && { name: event.sdk.name, version: event.sdk.version },
    transaction: event.transaction === undefined ? undefined : stripUrl(event.transaction),
    message: text(event.message),
    exception: event.exception?.values && { values: event.exception.values.slice(-10).map(scrubException) },
    breadcrumbs: breadcrumbs.length ? breadcrumbs : undefined,
    contexts: scrubContexts(event.contexts),
    tags: scrubTags(event.tags),
    request: event.request?.url ? { url: stripUrl(event.request.url) } : undefined,
    fingerprint: event.fingerprint?.map((f) => redact(f)),
  };
  for (const key of Object.keys(out) as Array<keyof Event>) if (out[key] === undefined) delete out[key];
  return out as T;
}
