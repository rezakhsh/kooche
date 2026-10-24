// Renders mockup pages at phone and computer size: node mockshoot.mjs d2/home d2/listing …
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch();
const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const desk = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
for (const name of process.argv.slice(2)) {
  for (const [size, ctx] of [['phone', phone], ['desktop', desk]]) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`file:///work/mock/${name}.html`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `/work/shots/mock/${name.replace('/', '-')}-${size}.jpg`, type: 'jpeg', quality: 82 });
    if (process.env.FULL) await p.screenshot({ path: `/work/shots/mock/${name.replace('/', '-')}-${size}-full.jpg`, type: 'jpeg', quality: 70, fullPage: true });
    console.log(errs.length ? 'ERR' : 'ok', name, size, errs.join(' | '));
    await p.close();
  }
}
await b.close();
