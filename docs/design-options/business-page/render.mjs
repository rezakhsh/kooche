// Renders the business page proposals: node render.mjs a a?state=contact …  Each at phone 390 and
// computer 1280, light and dark: the first screen (jpg) and, with FULL=1, the whole page.
import { createRequire } from 'node:module';
const { chromium } = createRequire('/pw/node_modules/x.js')('playwright');
const devices = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  computer: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};
const only = process.env.ONLY; // e.g. "phone-light"
const b = await chromium.launch();
for (const spec of process.argv.slice(2)) {
  const [page, q = ''] = spec.split('?');
  const state = new URLSearchParams(q).get('state');
  for (const [dev, d] of Object.entries(devices)) for (const theme of ['light', 'dark']) {
    if (only && !only.split(',').includes(`${dev}-${theme}`)) continue;
    const ctx = await b.newContext(d);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('requestfailed', (r) => errs.push('failed ' + r.url().slice(-60)));
    await p.goto(`file:///repo/docs/design-options/business-page/${page}.html?${q}${theme === 'dark' ? '&dark' : ''}`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    if (['about', 'recs'].includes(state) && dev === 'phone') await p.evaluate(() => { const n = document.querySelector('nav.sticky'); scrollTo(0, n.getBoundingClientRect().top + scrollY - 57 - 120); });
    await p.waitForTimeout(150);
    const name = `${page}${state ? '-' + state : ''}-${dev}-${theme}`;
    await p.screenshot({ path: `/m/mockup/${name}.jpg`, type: 'jpeg', quality: 80 });
    if (process.env.FULL) await p.screenshot({ path: `/m/mockup/${name}-full.jpg`, type: 'jpeg', quality: 72, fullPage: true });
    console.log(errs.length ? 'ERR' : 'ok', name, errs.join(' | '));
    await ctx.close();
  }
}
await b.close();
