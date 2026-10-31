import { describe, expect, it } from 'vitest';
import { openToPoster } from '../src/modules/listings/catalog';

// Business-only categories (jobs, tax, official translation…) are for members of a business
// (design check, Oct 31, 2026: the form sent everyone back, members too)
describe('who may open a category form', () => {
  it('opens a business-only category to members of a business only', () => {
    expect(openToPoster({ businessOnly: true }, true)).toBe(true);
    expect(openToPoster({ businessOnly: true }, false)).toBe(false);
  });
  it('opens every other category to everyone', () => {
    expect(openToPoster({ businessOnly: false }, false)).toBe(true);
    expect(openToPoster({ businessOnly: false }, true)).toBe(true);
  });
});
