// Signs in to staging with an email code the owner sends (the "send code" step, with Turnstile,
// happens on the owner's own phone), then screenshots the signed-in pages at phone and computer
// size. Names, emails, phone numbers and chat texts are replaced on the page before each shot.
// Usage: node shoot-signed-in.mjs <email> <code> <outdir>
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const [email, code, OUT] = process.argv.slice(2);
const BASE = 'https://staging.peydoo.com';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fa-IR' });
await ctx.addCookies([{ name: 'login_email', value: email, domain: 'staging.peydoo.com', path: '/login', httpOnly: true, secure: true, sameSite: 'Lax' }]);
const p = await ctx.newPage();
await p.goto(`${BASE}/login/code`, { waitUntil: 'load' });
await p.fill('input[name="code"]', code);
await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => null), p.click('button[type="submit"]')]);
await p.waitForTimeout(1500);
if (new URL(p.url()).pathname.startsWith('/login')) {
  console.log('SIGN-IN FAILED:', (await p.textContent('main'))?.replace(/\s+/g, ' ').slice(0, 300));
  await b.close();
  process.exit(1);
}
console.log('signed in, now at', new URL(p.url()).pathname);
writeFileSync('/work/state.json', JSON.stringify(await ctx.storageState()), { mode: 0o600 });

// Names to hide: the account's own name, and the people in the chat inbox
await p.goto(`${BASE}/account/name`, { waitUntil: 'load' });
const names = new Set([await p.inputValue('input[name="displayName"], input[name="name"]').catch(() => '')].filter(Boolean));
await p.goto(`${BASE}/chat`, { waitUntil: 'load' });
for (const n of await p.$$eval('main li a > span.min-w-0 > span:first-child > span:first-child', (els) => els.map((e) => e.textContent.trim()))) if (n) names.add(n);
const firstChat = await p.$eval('main li a[href^="/chat/"]', (a) => a.getAttribute('href')).catch(() => null);
const business = await (async () => { await p.goto(`${BASE}/business`, { waitUntil: 'load' }); return p.$eval('main a[href^="/b/"][href$="/manage"], main a[href^="/b/"]', (a) => a.getAttribute('href')).catch(() => null); })();
console.log('hiding', names.size, 'names; chat:', !!firstChat, 'business:', business);

async function mask(page) {
  await page.evaluate((names) => {
    // Chat texts: previews and bubbles
    document.querySelectorAll('main [dir="auto"]').forEach((e) => { if (e.closest('li a[href^="/chat/"]') || e.closest('[data-chat-thread]')) e.textContent = 'متن پیام'; });
    document.querySelectorAll('a[href^="/u/"]').forEach((a) => { const t = a.textContent.trim(); if (t && t.length < 60) names.push(t); });
    const initials = new Set(names.map((n) => [...n][0]));
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      let s = n.nodeValue;
      for (const name of names) if (name) s = s.split(name).join('کاربر نمونه');
      s = s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'name@example.com');
      s = s.replace(/(\+|00)?[\d۰-۹][\d۰-۹\s\-/]{7,}[\d۰-۹]/g, (m) => (m.replace(/\D/g, '').length >= 8 && !/^20\d\d/.test(m) ? '۰۱۵۷ ••• •• ••' : m));
      if (initials.has(s.trim()) && s.trim().length === 1 && n.parentElement && n.parentElement.children.length === 0) s = 'ک';
      if (s !== n.nodeValue) n.nodeValue = s;
    }
    document.querySelectorAll('input').forEach((i) => { if (i.type === 'email' || /@/.test(i.value)) i.value = 'name@example.com'; if (names.includes(i.value)) i.value = 'کاربر نمونه'; });
  }, [...names]);
}

const pages = [
  ['country', '/germany'],
  ['post-1', '/new'],
  ['post-2', '/new?c=real-estate'],
  ['post-form', '/new/shared-rooms'],
  ['my-listings', '/my/listings'],
  ['favorites', '/my/favorites'],
  ['searches', '/my/searches'],
  ['chat', '/chat'],
  ...(firstChat ? [['chat-thread', firstChat]] : []),
  ['account', '/account'],
  ['notifications', '/account/notifications'],
  ['business', '/business'],
  ...(business ? [['business-page', business]] : []),
  ['events-new', '/events/new'],
  ['my-events', '/my/events'],
  ['pro', '/pro'],
];
const desk = await b.newContext({ viewport: { width: 1280, height: 800 }, storageState: '/work/state.json', locale: 'fa-IR' });
for (const [size, page] of [['phone', p], ['desktop', await desk.newPage()]]) {
  for (const [name, path] of pages) {
    try {
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1200);
      await mask(page);
      await page.screenshot({ path: `${OUT}/${size}-${name}.jpg`, type: 'jpeg', quality: 80 });
      await page.screenshot({ path: `${OUT}/${size}-${name}-full.jpg`, type: 'jpeg', quality: 70, fullPage: true });
      console.log('ok', size, name);
    } catch (e) { console.log('fail', size, name, e.message.split('\n')[0]); }
  }
}
await b.close();
