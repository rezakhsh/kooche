// Draws the PNG icons and the share image from the logo (src/app/icon.svg) and the self-hosted
// Vazirmatn font, with headless Chromium. Run again when the logo or the slogan changes:
//   docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.63.0-noble \
//     sh -c 'npm i --no-save --prefix /tmp/pw playwright@1.63.0 && NODE_PATH=/tmp/pw/node_modules node scripts/brand-assets.mjs'
// Writes src/app/icon.png (512), apple-icon.png (180), favicon.ico (16, 32, 48) and
// opengraph-image.png (1200×630), which Next.js serves by their file names.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const app = new URL('../src/app/', import.meta.url).pathname;
const logo = await readFile(`${app}icon.svg`, 'utf8');
const font = (await readFile(`${app}fonts/Vazirmatn-subset.woff2`)).toString('base64');
const fa = (await readFile(new URL('../src/messages/fa.ts', import.meta.url), 'utf8')).match(/site: \{[\s\S]*?\n {2}\}/)[0];
const text = (key) => fa.match(new RegExp(`${key}: '([^']+)'`))[1];

const browser = await chromium.launch();
const page = await browser.newPage();

async function png(html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html dir="rtl"><head><style>
    @font-face { font-family: V; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: transparent; font-family: V; }
  </style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ omitBackground: true });
}

const square = (size, pad = 0) =>
  png(`<div style="width:${size}px;height:${size}px;padding:${pad}px;box-sizing:border-box">${logo.replace('<svg ', `<svg width="${size - 2 * pad}" height="${size - 2 * pad}" `)}</div>`, size, size);

await writeFile(`${app}icon.png`, await square(512));
// iOS draws its own rounded corners on a full square, so the apple icon is the plain turquoise square
await writeFile(`${app}apple-icon.png`, await png(`<div style="width:180px;height:180px;background:#0B6E77">${logo.replace('<svg ', '<svg width="180" height="180" ').replace('rx="26"', 'rx="0"')}</div>`, 180, 180));

// favicon.ico with PNG images inside (supported by every current browser)
const sizes = [16, 32, 48];
const images = [];
for (const s of sizes) images.push(await square(s));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(images[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
await writeFile(`${app}favicon.ico`, Buffer.concat([header, ...images]));

// The share image shown on Telegram, WhatsApp and Instagram for pages without their own photo
await writeFile(
  `${app}opengraph-image.png`,
  await png(
    `<div style="width:1200px;height:630px;background:linear-gradient(180deg,#E6F2F1,#fff 70%);display:flex;flex-direction:column;justify-content:center;padding:0 110px;box-sizing:border-box;color:#16211F">
      <div style="display:flex;align-items:center;gap:36px">
        ${logo.replace('<svg ', '<svg width="170" height="170" ')}
        <div><div style="font-size:150px;font-weight:900;line-height:1">${text('name')}</div>
        <div style="font-size:40px;font-weight:600;color:#44524F;margin-top:22px">${text('tagline')}</div></div>
      </div>
      <div style="margin-top:70px;font-size:56px;font-weight:800;color:#0B6E77">${text('slogan')}</div>
      <div style="position:absolute;bottom:0;inset-inline:0;height:14px;background:#0B6E77"></div>
      <div style="position:absolute;bottom:14px;inset-inline-start:0;width:200px;height:14px;background:#E9A21A"></div>
    </div>`,
    1200,
    630,
  ),
);

await browser.close();
console.log('brand assets written');
