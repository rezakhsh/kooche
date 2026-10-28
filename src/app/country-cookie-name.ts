// Shared by the server (country-choice.ts) and the browser (remember-country.tsx)
export const COUNTRY_COOKIE = 'country';
export const COUNTRY_COOKIE_MAX_AGE = 365 * 86_400;
/** Grid or list on listing pages (approved Oct 17, 2026); nothing personal */
export const VIEW_COOKIE = 'view';
/** Light or dark when the visitor chose one (wave 1, part 10); no cookie means automatic */
export const THEME_COOKIE = 'theme';
