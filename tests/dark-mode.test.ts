import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { themeOf } from '../src/app/theme';

// Dark mode (wave 1, part 10) is a second value for each colour name in src/app/globals.css.
// These checks keep it that way as pages change: both dark blocks agree, every colour the pages
// use has a dark value, text keeps WCAG AA contrast (4.5:1) in light and dark, and `text-white`
// (which turns dark in dark mode) only sits on fills that turn light with it.

const css = readFileSync('src/app/globals.css', 'utf8');
const tailwind = readFileSync('node_modules/tailwindcss/theme.css', 'utf8');

function vars(block: string): Map<string, string> {
  return new Map([...block.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}
function blockAfter(source: string, opener: string): string {
  const start = source.indexOf(opener);
  if (start < 0) throw new Error(`missing ${opener}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`unclosed ${opener}`);
}

const light = new Map([...vars(blockAfter(tailwind, '@theme')), ['white', '#ffffff'], ...vars(blockAfter(css, '@theme'))]);
const mediaDark = vars(blockAfter(blockAfter(css, '@media (prefers-color-scheme: dark)'), ":root:not([data-theme='light'])"));
const chosenDark = vars(blockAfter(css, ":root[data-theme='dark']"));
const dark = new Map([...light, ...chosenDark]);

/** sRGB [0..1] from #rrggbb or Tailwind's oklch(L% C H) */
function rgb(value: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16) / 255) as [number, number, number];
  const ok = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(value);
  if (!ok) throw new Error(`unknown colour ${value}`);
  const [L, C, H] = [Number(ok[1]) / 100, Number(ok[2]), (Number(ok[3]) * Math.PI) / 180];
  const [a, b] = [C * Math.cos(H), C * Math.sin(H)];
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return lin.map((c) => Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))) as [number, number, number];
}
function luminance(value: string): number {
  const [r, g, b] = rgb(value).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(palette: Map<string, string>, fg: string, bg: string): number {
  const [a, b] = [luminance(palette.get(fg)!), luminance(palette.get(bg)!)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Text colours and the surfaces they sit on; [text, background] */
const SURFACES = ['white', 'neutral-50', 'page'];
const PAIRS: Array<[string, string]> = [
  ...['neutral-500', 'neutral-600', 'neutral-700', 'neutral-800', 'neutral-900', 'brand-700', 'brand-800', 'saffron-800', 'red-700', 'red-800', 'green-800'].flatMap((t) =>
    SURFACES.map((s) => [t, s] as [string, string]),
  ),
  ['neutral-600', 'neutral-100'],
  ['brand-700', 'brand-50'],
  ['brand-800', 'brand-50'],
  ['saffron-700', 'saffron-50'],
  ['saffron-800', 'saffron-50'],
  ['red-700', 'red-50'],
  ['red-800', 'red-50'],
  ['red-900', 'red-50'],
  ['green-800', 'green-50'],
  ['amber-800', 'amber-50'],
  ['amber-900', 'amber-50'],
  // Fills: `text-white` on turquoise and near-black, `snow` on red and the deep turquoise, `ink` on saffron
  ['white', 'brand-700'],
  ['white', 'brand-800'],
  ['white', 'neutral-900'],
  ['snow', 'danger'],
  ['snow', 'danger-hover'],
  ['snow', 'brand-900'],
  ['snow', 'brand-950'],
  ['ink', 'saffron-500'],
  ['ink', 'saffron-400'],
];

/** Shades kept dark on purpose: posters, the admin bar, the photo viewer, backdrops */
const ALWAYS_DARK = new Set(['brand-900', 'brand-950', 'neutral-950']);
const FIXED = new Set(['snow', 'ink']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}
const sources = sourceFiles('src').map((path) => ({ path, text: readFileSync(path, 'utf8') }));

describe('dark mode', () => {
  it('has the same dark values for the device setting and the chosen one', () => {
    expect([...mediaDark]).toEqual([...chosenDark]);
    expect(chosenDark.size).toBeGreaterThan(40);
  });

  it.each(PAIRS)('%s on %s passes AA in light and dark', (fg, bg) => {
    expect(contrast(light, fg, bg), 'light').toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark, fg, bg), 'dark').toBeGreaterThanOrEqual(4.5);
  });

  it('gives every colour the pages use a dark value', () => {
    const used = new Set<string>();
    for (const { text } of sources) {
      for (const m of text.matchAll(/\b(?:bg|text|border(?:-[setbxy])?|ring|divide|fill|stroke|from|via|to|outline|accent|decoration|placeholder)-([a-z]+(?:-\d+)?)(?:\/\d+)?\b/g)) {
        const name = m[1]!;
        if (light.has(name) && !/^(?:black|transparent|current)$/.test(name)) used.add(name);
      }
    }
    const missing = [...used].filter((n) => !chosenDark.has(n) && !ALWAYS_DARK.has(n) && !FIXED.has(n));
    expect(missing).toEqual([]);
  });

  it('puts text-white only on fills that turn light in dark mode', () => {
    const wrong = sources.flatMap(({ path, text }) =>
      text
        .split('\n')
        .map((line, i) => [line, i + 1] as const)
        .filter(([line]) => /\btext-white\b/.test(line) && !path.endsWith('globals.css'))
        .filter(([line]) => !/bg-brand-[67]00|bg-neutral-900\b|bg-\[#2aabee\]/.test(line))
        .map(([, n]) => `${path}:${n}`),
    );
    expect(wrong).toEqual([]);
  });

  it('reads the theme cookie', () => {
    expect(themeOf('dark')).toBe('dark');
    expect(themeOf('light')).toBe('light');
    expect(themeOf(undefined)).toBe('auto');
    expect(themeOf('blue')).toBe('auto');
  });
});
