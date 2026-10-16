// Fails when src/ uses physical-direction Tailwind classes (ml-4, pr-2, left-0, text-right,
// rounded-l-md…). The interface is right-to-left, so only logical classes are allowed
// (ms-, me-, ps-, pe-, start-, end-, text-start, rounded-s-…). Run by `npm run check:rtl` and the
// Docker build.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname;
const EXTENSIONS = /\.(tsx?|css|mdx?)$/;
const VALUE = String.raw`(?:\d|px|auto|full|\[)`;
const PHYSICAL = new RegExp(
  String.raw`(?<![\w-])-?(?:(?:scroll-)?[mp][lr]|left|right|inset-[lr]?|border-[lr]|rounded-(?:[lr]|[tb][lr])|space-[lr])-${VALUE}` +
    String.raw`|(?<![\w-])(?:border-[lr]|rounded-(?:[lr]|[tb][lr]))(?![\w-])` +
    String.raw`|(?<![\w-])(?:text|float|clear)-(?:left|right)(?![\w-])`,
  'g',
);

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (EXTENSIONS.test(entry.name)) yield path;
  }
}

let problems = 0;
for await (const file of files(ROOT)) {
  const lines = (await readFile(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const match of line.matchAll(PHYSICAL)) {
      console.error(`${file.slice(ROOT.length - 4)}:${i + 1}: "${match[0]}" is a physical class, use a logical one`);
      problems++;
    }
  });
}
if (problems > 0) process.exit(1);
console.log('check:rtl: no physical-direction classes');
