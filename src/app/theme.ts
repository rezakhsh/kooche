import { cookies } from 'next/headers';
import { THEME_COOKIE } from './country-cookie-name';

// Dark mode (wave 1, part 10): automatic by default, following the device through
// prefers-color-scheme in globals.css. Choosing light or dark in Settings › Appearance or the
// footer stores it in the `theme` cookie; the root layout writes it as data-theme on <html>, so the
// page arrives in the right colours without a flash. Nothing personal, no account needed.

export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export function themeOf(value: string | undefined | null): Theme {
  return value === 'light' || value === 'dark' ? value : 'auto';
}

export async function currentTheme(): Promise<Theme> {
  return themeOf((await cookies()).get(THEME_COOKIE)?.value);
}
