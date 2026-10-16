// A short device description for the "my devices" page, from the User-Agent header. Deliberately
// small: the main browsers and systems, anything else is "unknown". Names stay Latin (brands).

export type Device = { browser: string | null; os: string | null; mobile: boolean };

const BROWSERS: Array<[RegExp, string]> = [
  [/EdgA?\/|Edg\//, 'Edge'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/OPR\/|Opera/, 'Opera'],
  [/YaBrowser\//, 'Yandex'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/CriOS\/|Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/iPad/, 'iPadOS'],
  [/iPhone|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

export function describeDevice(userAgent: string | null | undefined): Device {
  const ua = userAgent ?? '';
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? null;
  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? null;
  return { browser, os, mobile: /Mobi|Android|iPhone|iPad/.test(ua) };
}
