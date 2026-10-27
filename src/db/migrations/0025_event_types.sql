-- Wave 1, part 6 (mockups final/events, post-event1): the event types become the eight chips of
-- the design. The seed renames the rest (seed/categories.ts) and retires what it no longer lists;
-- this moves the events of the merged types first, so no event is left in a retired type:
-- celebrations into parties, theatre, film and talks into «فرهنگی و ادبی», and religious
-- ceremonies become «یادبود و همبستگی» (the same category under its new slug).
UPDATE categories SET slug = 'event-memorials', path = 'events-calendar.event-memorials'
WHERE slug = 'event-religious' AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'event-memorials');--> statement-breakpoint
UPDATE listings SET category_id = (SELECT id FROM categories WHERE slug = 'event-parties')
WHERE category_id = (SELECT id FROM categories WHERE slug = 'event-celebrations');--> statement-breakpoint
UPDATE listings SET category_id = (SELECT id FROM categories WHERE slug = 'event-readings')
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('event-theatre', 'event-film', 'event-talks'));--> statement-breakpoint
-- Search reads the category from the listing: queue a sync of the moved, live ones
INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id)
SELECT 'listing.updated', 'listing', l.id FROM listings l
JOIN categories c ON c.id = l.category_id
WHERE c.slug IN ('event-parties', 'event-readings', 'event-memorials') AND l.status = 'active';
