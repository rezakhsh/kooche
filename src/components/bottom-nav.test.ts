import { describe, expect, it } from 'vitest';
import { showsBottomNav } from './bottom-nav';

// Owner, Oct 31, 2026: on every page but those with their own bar at the bottom (a listing's
// contact bar, a draft's steps and similar hide it in CSS, see globals.css)
describe('the bottom bar', () => {
  it('shows on browsing, account, settings and form pages', () => {
    for (const p of ['/', '/germany', '/germany/berlin', '/germany/events', '/b/shop', '/b/shop/manage', '/u/abc', '/chat', '/my/listings', '/account', '/help', '/v/x/abc', '/my/listings/123', '/my/orders/1/withdraw', '/b/shop/edit', '/b/shop/billing', '/account/phone', '/login', '/report', '/waitlist/leave', '/cities']) {
      expect(showsBottomNav(p), p).toBe(true);
    }
  });
  it('leaves a conversation and posting to themselves', () => {
    for (const p of ['/chat/123', '/chat/new', '/new', '/new/rooms', '/events/new', '/business/new']) {
      expect(showsBottomNav(p), p).toBe(false);
    }
  });
});
