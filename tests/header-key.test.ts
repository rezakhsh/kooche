import { describe, expect, it } from 'vitest';
import { headerKey } from '../src/components/header-key';

// The header follows the page on in-app links (src/components/header-sync.tsx; owner, Oct 31, 2026:
// after choosing Canada the header kept Germany until a refresh).
describe('header key', () => {
  const slugs = ['germany', 'canada', 'turkey'];

  it('changes with the country, the city and the category of the address', () => {
    expect(headerKey('/germany/berlin', slugs, 'germany')).toBe('germany/berlin|germany');
    expect(headerKey('/germany/berlin/translation', slugs, 'germany')).not.toBe(headerKey('/germany/berlin', slugs, 'germany'));
    expect(headerKey('/canada', slugs, 'germany')).not.toBe(headerKey('/germany', slugs, 'germany'));
  });

  it('changes with the remembered country, which the logo follows', () => {
    expect(headerKey('/help', slugs, 'canada')).not.toBe(headerKey('/help', slugs, 'germany'));
  });

  it('marks the sign-in pages and stays the same between other pages', () => {
    expect(headerKey('/login', slugs, null)).toBe('login|');
    expect(headerKey('/login/code', slugs, null)).toBe('login|');
    expect(headerKey('/v/a/abc123', slugs, 'germany')).toBe(headerKey('/help', slugs, 'germany'));
  });
});
