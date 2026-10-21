import { describe, expect, it } from 'vitest';
import { cardFacts } from '../src/modules/listings/attribute-text';
import { effectiveAttributes, loadCatalog, type Catalog } from '../src/modules/listings/catalog';
import { db } from './db';

// The facts under a card's price: the category's show_on_card fields, at most three, in form order

let catalog: Catalog;
const eur = () => catalog.currencies.get('EUR');
const facts = (slug: string, attributes: Record<string, unknown>) =>
  cardFacts(catalog, catalog.bySlug.get(slug)!.id, attributes, eur()).map((f) => f.text);

describe('card facts', async () => {
  catalog = await loadCatalog(db);

  it('cars show year, mileage and fuel, not make and model', () => {
    const out = facts('cars', { brand: 'bmw', model: 'bmw-3', year: 2018, mileage_km: 120_000, fuel: 'diesel', damage: 'none' });
    expect(out).toHaveLength(3);
    // A year has no thousands separator; a mileage has one
    expect(out[0]).toBe('۲۰۱۸');
    expect(out[1]).toMatch(/^۱۲۰٬۰۰۰ /);
    expect(out[2]).toBe(catalog.bySlug.get('cars')!.ownAttributes.find((a) => a.key === 'fuel')!.options.find((o) => o.value === 'diesel')!.labelFa);
  });

  it('skips empty fields and keeps form order', () => {
    expect(facts('cars', { fuel: 'diesel', year: 2010 })).toEqual(['۲۰۱۰', expect.any(String)]);
    expect(facts('cars', {})).toEqual([]);
  });

  it('flats show size and rooms; a count without a unit carries its label', () => {
    const rooms = effectiveAttributes(catalog, catalog.bySlug.get('apartments-rent')!.id).find((a) => a.key === 'rooms')!.labelFa;
    const out = facts('apartments-rent', { area_m2: 65, rooms: 2, extra_costs: 20000 });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^۶۵ /);
    expect(out[1]).toBe(`${rooms} ۲`);
  });

  it('yes/no fields show their label when yes and nothing when no; amounts use the currency', () => {
    const yes = facts('it-jobs', { employment_type: 'full_time', salary: 450_000, persian_speaking: true });
    const label = catalog.bySlug.get('jobs')!.ownAttributes.find((a) => a.key === 'persian_speaking')?.labelFa;
    // Type, salary and the yes/no field's label (work mode is empty)
    expect(yes).toHaveLength(3);
    expect(yes[1]).toContain('€');
    const no = facts('it-jobs', { persian_speaking: false });
    expect(no).toEqual([]);
    expect(facts('it-jobs', { persian_speaking: true })).toEqual([label]);
  });

  it('a checklist shows two values and an ellipsis', () => {
    const def = catalog.bySlug.get('translation')!.ownAttributes.find((a) => a.key === 'languages')!;
    const values = def.options.slice(0, 3).map((o) => o.value);
    const out = facts('translation', { languages: values });
    expect(out.at(-1)).toBe(`${def.options[0]!.labelFa}، ${def.options[1]!.labelFa}…`);
  });

  it('never more than three', () => {
    const out = facts('tires-rims', { wheel_item: 'tires', condition: 'used', tire_season: 'winter', rim_inch: 17, piece_count: 4 });
    expect(out).toHaveLength(3);
  });

  it('a retired field is not shown, a category without card fields shows nothing', () => {
    const cars = catalog.bySlug.get('cars')!;
    const year = cars.ownAttributes.find((a) => a.key === 'year') ?? catalog.bySlug.get('vehicles')!.ownAttributes.find((a) => a.key === 'year');
    if (year) {
      year.isActive = false;
      try {
        expect(facts('cars', { year: 2018 })).toEqual([]);
      } finally {
        year.isActive = true;
      }
    }
    expect(facts('garden-plants', { anything: 'x' })).toEqual([]);
    expect(cardFacts(catalog, null, { year: 2018 }, eur())).toEqual([]);
  });
});
