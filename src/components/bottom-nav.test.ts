import { describe, expect, it } from 'vitest';
import { showsBottomNav } from './bottom-nav';

describe('the bottom bar (wave 1: only on browsing pages)', () => {
  it('shows where people browse and on its own tabs', () => {
    for (const p of ['/', '/germany', '/germany/berlin', '/germany/events', '/v/x/abc', '/b/shop', '/u/abc', '/chat', '/my/listings', '/account', '/help']) {
      expect(showsBottomNav(p), p).toBe(true);
    }
  });
  it('leaves task pages to themselves', () => {
    for (const p of ['/chat/123', '/new', '/new/rooms', '/my/listings/123', '/my/orders/1/withdraw', '/events/new', '/business/new', '/b/shop/manage', '/account/phone', '/login', '/report', '/waitlist/leave']) {
      expect(showsBottomNav(p), p).toBe(false);
    }
  });
});
