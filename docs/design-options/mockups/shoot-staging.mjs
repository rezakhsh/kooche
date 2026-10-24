// Screenshots of staging's public pages at phone and computer size. Seller names, emails and
// phone-like numbers are replaced on the page before each shot (no real user data in the output).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = 'https://staging.peydoo.com';
const OUT = process.argv[2];
const L = {
  rugs: '/v/%D9%81%D8%B1%D8%B4-%D9%86%D9%88-%D8%A7%D8%A8%D8%B1%DB%8C%D8%B4%D9%85%DB%8C-%D8%A7%DB%8C%D8%B1%D8%A7%D9%86%DB%8C-%D9%82%D9%85-%D8%B3%D8%A7%DB%8C%D8%B2-155-255/xs2djd55xn',
  room: '/v/%D8%A7%D8%AC%D8%A7%D8%B1%D9%87-%D8%AE%D8%A7%D9%86%D9%87-%D8%AF%D8%B1-%D9%88%D8%AF%DB%8C%D9%86%DA%AF/dedeq1eh6x',
  photo: '/v/%D8%B9%DA%A9%D8%A7%D8%B3%DB%8C-%D8%A7%D8%B2-%D9%85%D8%AC%D8%A7%D9%84%D8%B3-%D8%B4%D9%85%D8%A7/4v2d7z0wjq',
  lesson: '/v/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D8%B9%DA%A9%D8%A7%D8%B3%DB%8C/6c1fsyt0vy',
};
const pages = [
  ['home', '/'],
  ['choose', '/?choose'],
  ['country', '/germany'],
  ['country-list', '/germany?view=list'],
  ['category-realestate', '/germany/real-estate'],
  ['category-services', '/germany/services'],
  ['city', '/germany/berlin'],
  ['empty-austria', '/austria'],
  ['search', '/germany?q=%D8%B9%DA%A9%D8%A7%D8%B3%DB%8C'],
  ['events', '/germany/events'],
  ['listing-rugs', L.rugs],
  ['listing-room', L.room],
  ['listing-photo', L.photo],
  ['login', '/login?next=%2Fnew'],
  ['pro', '/pro'],
  ['safety', '/safety'],
];
const sizes = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, desktop: { width: 1280, height: 800, deviceScaleFactor: 1 } };

async function mask(page) {
  await page.evaluate(() => {
    const names = new Set();
    document.querySelectorAll('a[href^="/u/"]').forEach((a) => { const t = a.textContent.trim(); if (t && t.length < 60) names.add(t); });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const initials = new Set([...names].map((n) => [...n][0]));
    let n;
    while ((n = walker.nextNode())) {
      let s = n.nodeValue;
      for (const name of names) s = s.split(name).join('فروشنده نمونه');
      s = s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'name@example.com');
      s = s.replace(/(\+|00)?[\d۰-۹][\d۰-۹\s\-/]{7,}[\d۰-۹]/g, (m) => (m.replace(/\D/g, '').length >= 8 && !/^20\d\d/.test(m) ? '۰۱۵۷ ••• •• ••' : m));
      if (initials.has(s.trim()) && n.parentElement && n.parentElement.children.length === 0 && s.trim().length === 1) s = 'ف';
      if (s !== n.nodeValue) n.nodeValue = s;
    }
  });
}

const browser = await chromium.launch();
for (const [sizeName, vp] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, locale: 'fa-IR' });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 });
      await page.evaluate(() => document.fonts.ready);
      await mask(page);
      await page.screenshot({ path: `${OUT}/${sizeName}-${name}.png` });
      await page.screenshot({ path: `${OUT}/${sizeName}-${name}-full.png`, fullPage: true });
      console.log('ok', sizeName, name);
    } catch (e) { console.log('fail', sizeName, name, e.message.split('\n')[0]); }
  }
  if (sizeName === 'phone') {
    // The two bottom sheets on the country page, and the photo viewer
    for (const [name, path, i] of [['sheet-categories', '/germany', 0], ['sheet-filters', '/germany/real-estate', 1]]) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      await page.evaluate((i) => { document.querySelectorAll('details')[i].open = true; }, i);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/phone-${name}.png` });
      console.log('ok', name);
    }
    await page.goto(BASE + L.rugs, { waitUntil: 'networkidle' });
    await mask(page);
    const img = page.locator('main img').first();
    if (await img.count()) { await img.click(); await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/phone-gallery.png` }); console.log('ok gallery'); }
  }
  await ctx.close();
}
await browser.close();
