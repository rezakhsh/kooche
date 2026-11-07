import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  eventGoneSince,
  GONE_AFTER_DAYS,
  goneForGood,
  isProductListing,
  jsonLdText,
  listingGoneSince,
} from '../src/modules/listings/seo';

// What search engines read on the listing, event and business pages (docs/research/seo.md,
// section 5): Product markup only for goods offered, the breadcrumb trail, and the 30-day rule
// after which a sold or expired listing (or an ended event) answers 404

const DAY = 86_400_000;
const now = new Date('2026-11-07T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * DAY);

describe('Product markup', () => {
  it('only for offers in a goods category', () => {
    expect(isProductListing([{ slug: 'vehicles' }, { slug: 'cars' }], 'offer')).toBe(true);
    expect(isProductListing([{ slug: 'electronics' }, { slug: 'mobile-phones' }], 'offer')).toBe(true);
    expect(isProductListing([{ slug: 'leisure-hobbies' }, { slug: 'tickets' }], 'offer')).toBe(true);
    expect(isProductListing([{ slug: 'business-equipment' }], 'offer')).toBe(true);
  });

  it('never for a «wanted» ad', () => {
    expect(isProductListing([{ slug: 'vehicles' }, { slug: 'cars' }], 'wanted')).toBe(false);
  });

  it('never for homes, jobs, services, lessons, community, pets or events', () => {
    for (const root of ['real-estate', 'jobs', 'services', 'lessons-courses', 'community', 'pets', 'events-calendar']) {
      expect(isProductListing([{ slug: root }], 'offer')).toBe(false);
    }
    expect(isProductListing([], 'offer')).toBe(false);
  });
});

describe('the 30-day rule', () => {
  it('a sold or expired listing answers 404 after GONE_AFTER_DAYS from its status change', () => {
    expect(GONE_AFTER_DAYS).toBe(30);
    for (const status of ['sold', 'expired']) {
      expect(goneForGood(listingGoneSince({ status, statusChangedAt: ago(29) }), now)).toBe(false);
      expect(goneForGood(listingGoneSince({ status, statusChangedAt: ago(30) }), now)).toBe(false);
      expect(goneForGood(listingGoneSince({ status, statusChangedAt: ago(30.01) }), now)).toBe(true);
      expect(goneForGood(listingGoneSince({ status, statusChangedAt: ago(400) }), now)).toBe(true);
    }
  });

  it('never for an active or paused listing, however old the change', () => {
    expect(goneForGood(listingGoneSince({ status: 'paused', statusChangedAt: ago(400) }), now)).toBe(false);
    expect(goneForGood(listingGoneSince({ status: 'active', statusChangedAt: ago(400) }), now)).toBe(false);
  });

  it('an event counts from the end of its last date', () => {
    const dates = [
      { endsAt: ago(60) },
      { endsAt: ago(31) },
      { endsAt: ago(45) },
    ];
    expect(eventGoneSince(dates)).toEqual(ago(31));
    expect(goneForGood(eventGoneSince(dates), now)).toBe(true);
    expect(goneForGood(eventGoneSince([...dates, { endsAt: ago(10) }]), now)).toBe(false);
    expect(goneForGood(eventGoneSince([{ endsAt: new Date(now.getTime() + DAY) }]), now)).toBe(false);
    expect(eventGoneSince([])).toBeNull();
    expect(goneForGood(null, now)).toBe(false);
  });
});

describe('the breadcrumb trail', () => {
  it('has absolute addresses and leaves the page itself without one', () => {
    const ld = breadcrumbJsonLd('https://peydoo.example', [
      { name: 'خانه', path: '/' },
      { name: 'آلمان', path: '/germany' },
      { name: 'برلین', path: '/germany/berlin' },
      { name: 'خودرو', path: '/germany/berlin/cars' },
      { name: 'فولکس‌واگن گلف' },
    ]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement[0]).toEqual({ '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://peydoo.example/' });
    expect(ld.itemListElement[3]).toEqual({ '@type': 'ListItem', position: 4, name: 'خودرو', item: 'https://peydoo.example/germany/berlin/cars' });
    expect(ld.itemListElement[4]).toEqual({ '@type': 'ListItem', position: 5, name: 'فولکس‌واگن گلف' });
  });

  it('one object stays an object, several become an array, and «<» is escaped', () => {
    expect(JSON.parse(jsonLdText([{ a: 1 }]))).toEqual({ a: 1 });
    expect(JSON.parse(jsonLdText([{ a: 1 }, { b: 2 }]))).toEqual([{ a: 1 }, { b: 2 }]);
    expect(jsonLdText([{ name: '</script><script>' }])).not.toContain('<');
  });
});
