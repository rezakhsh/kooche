// Waits on the admin's two-step page until the owner's code appears in /work/totp.txt, enters it,
// then screenshots every admin page in the menu (computer and phone). Names, emails, phone
// numbers and IP addresses are replaced before each shot. Nothing is changed in the admin.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const ADMIN = `https://staging.peydoo.com/${process.env.ADMIN_PATH}`;
const OUT = '/work/shots/admin';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, storageState: '/work/state.json', locale: 'fa-IR' });
const p = await ctx.newPage();
await p.goto(`${ADMIN}/verify`, { waitUntil: 'load' });
const verified = !new URL(p.url()).pathname.endsWith('/verify') || (await p.goto(ADMIN, { waitUntil: 'load' }), !new URL(p.url()).pathname.endsWith('/verify'));
if (!verified) await p.goto(`${ADMIN}/verify`, { waitUntil: 'load' });
await p.screenshot({ path: `${OUT}/desktop-verify.jpg`, type: 'jpeg', quality: 80 });
if (!verified) {
console.log('waiting for the code');
const until = Date.now() + 20 * 60 * 1000;
while (!existsSync('/work/totp.txt') && Date.now() < until) await p.waitForTimeout(250);
if (!existsSync('/work/totp.txt')) { console.log('no code within 20 minutes'); await b.close(); process.exit(1); }
const code = readFileSync('/work/totp.txt', 'utf8').trim();
unlinkSync('/work/totp.txt');
const backup = !/^[0-9۰-۹ ]{6,7}$/.test(code);
const form = p.locator('form').filter({ has: p.locator(`input[name="kind"][value="${backup ? 'backup' : 'totp'}"]`) });
await form.locator('input[name="code"]').fill(code);
await form.locator('button[type="submit"]').click();
await p.waitForURL((u) => !u.pathname.endsWith('/verify'), { timeout: 10000 }).catch(() => null);
if (new URL(p.url()).pathname.endsWith('/verify')) {
  await p.screenshot({ path: `${OUT}/desktop-verify-refused.jpg`, type: 'jpeg', quality: 80 });
  console.log('CODE REFUSED:', (await p.textContent('body'))?.replace(/\s+/g, ' ').slice(0, 400));
  await b.close();
  process.exit(1);
}
}
console.log('admin verified');
await p.goto(ADMIN, { waitUntil: 'load' });

// Display names from the users list (staging has few users), hidden on every page
await p.goto(`${ADMIN}/users`, { waitUntil: 'load' });
const NAMES = (await p.$$eval('a[href*="/users/"] bdi', (as) => as.map((a) => a.textContent.trim()))).filter((n) => n && n !== 'کاربر حذف‌شده' && n.length < 60);
console.log('names to hide:', NAMES.length);
async function mask(page) {
  await page.evaluate((LIST) => {
    const names = new Set(LIST);
    document.querySelectorAll('a[href*="/users/"], a[href^="/u/"]').forEach((a) => { const t = a.textContent.trim(); if (t && t.length < 60 && !/^(کاربران|users)$/i.test(t)) names.add(t); });
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      let s = n.nodeValue;
      for (const name of names) s = s.split(name).join('کاربر نمونه');
      s = s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'name@example.com');
      s = s.replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '0.0.0.0').replace(/\b[0-9a-f]{1,4}(:[0-9a-f]{0,4}){3,7}\b/gi, '::');
      s = s.replace(/(\+|00)?[\d۰-۹][\d۰-۹\s\-/]{7,}[\d۰-۹]/g, (m) => (m.replace(/\D/g, '').length >= 8 && !/^(20\d\d|1\d{8})/.test(m.replace(/\D/g, '')) ? '۰۱۵۷ ••• •• ••' : m));
      if (s !== n.nodeValue) n.nodeValue = s;
    }
    document.querySelectorAll('input').forEach((i) => { if (/@/.test(i.value)) i.value = 'name@example.com'; });
  }, NAMES);
}

// The menu's pages, then one item page from the queue or the listings
const links = [...new Set(await p.$$eval('nav a[href]', (as) => as.map((a) => a.getAttribute('href'))))].filter((h) => h.startsWith(`/${process.env.ADMIN_PATH}`));
const pages = links.map((h) => [h.split('/').filter(Boolean).slice(1).join('-') || 'overview', h]);
for (const src of ['queue', 'listings', 'users']) {
  await p.goto(`${ADMIN}/${src}`, { waitUntil: 'load' });
  const item = await p.$eval(`a[href*="/${src === 'users' ? 'users' : 'items'}/"]`, (a) => a.getAttribute('href')).catch(() => null);
  if (item) pages.push([`${src}-detail`, item]);
}
console.log('pages:', pages.map((x) => x[0]).join(' '));
const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storageState: await ctx.storageState(), locale: 'fa-IR' })).newPage();
for (const [size, page] of [['desktop', p], ['phone', phone]]) {
  for (const [name, href] of pages) {
    try {
      await page.goto(`https://staging.peydoo.com${href}`, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(800);
      await mask(page);
      await page.screenshot({ path: `${OUT}/${size}-${name}.jpg`, type: 'jpeg', quality: 80 });
      await page.screenshot({ path: `${OUT}/${size}-${name}-full.jpg`, type: 'jpeg', quality: 70, fullPage: true });
      console.log('ok', size, name);
    } catch (e) { console.log('fail', size, name, e.message.split('\n')[0]); }
  }
}
await b.close();
