import { describe, expect, it } from 'vitest';
import { carBrands, carModels } from '../../../seed/car-models';
import { validateAttributes } from './attributes';
import type { AttributeDef } from './catalog';
import { dependentOptions, parentOf } from './dependent-options';

// The car make and model selects from the seed, as the posting form gets them
const def = (d: Partial<AttributeDef> & Pick<AttributeDef, 'key' | 'labelFa' | 'options'>): AttributeDef => ({
  type: 'select',
  unitFa: null,
  helpFa: null,
  validation: {},
  dependsOn: null,
  isRequired: false,
  isFilterable: true,
  showOnCard: false,
  isActive: true,
  ...d,
});
const brand = def({
  key: 'brand',
  labelFa: 'برند',
  isRequired: true,
  options: [...carBrands, ['other', 'سایر']].map(([value, labelFa]) => ({ value: value!, labelFa: labelFa!, parentValue: null })),
});
const model = def({
  key: 'model',
  labelFa: 'مدل',
  dependsOn: 'brand',
  isRequired: true,
  options: carModels.map((m) => ({ value: m.value, labelFa: m.labelFa, parentValue: m.parent })),
});

describe('dependent model options (posting form)', () => {
  it('lists only the chosen make’s models', () => {
    const r = dependentOptions(model, brand, 'peugeot');
    expect(r.kind).toBe('flat');
    if (r.kind !== 'flat') return;
    expect(r.options.length).toBeGreaterThan(1);
    expect(r.options.every((o) => o.parentValue === 'peugeot')).toBe(true);
    expect(r.options.at(-1)).toMatchObject({ value: 'peugeot-other-model', labelFa: 'سایر مدل‌ها' });
  });

  it('before a make: every model, grouped under its make in the makes’ order, so the select opens', () => {
    const r = dependentOptions(model, brand, undefined);
    expect(r.kind).toBe('grouped');
    if (r.kind !== 'grouped') return;
    // Every make has at least «سایر مدل‌ها», «سایر» included
    expect(r.groups.map((g) => g.value)).toEqual(brand.options.map((o) => o.value));
    expect(r.groups[0]!.labelFa).toBe('فولکس‌واگن');
    expect(r.groups.flatMap((g) => g.options)).toHaveLength(model.options.length);
    for (const g of r.groups) expect(g.options.every((o) => o.parentValue === g.value)).toBe(true);
  });

  it('a make without a model list offers «سایر مدل‌ها»', () => {
    const r = dependentOptions(model, brand, 'other');
    expect(r).toEqual({ kind: 'flat', options: [{ value: 'other-other-model', labelFa: 'سایر مدل‌ها', parentValue: 'other' }] });
  });

  it('a select that depends on nothing is left alone', () => {
    expect(dependentOptions(brand, undefined, undefined)).toEqual({ kind: 'flat', options: brand.options });
  });

  it('options without a parent stay ungrouped, first', () => {
    const karat = def({
      key: 'gold_karat',
      labelFa: 'عیار',
      dependsOn: 'jewelry_material',
      options: [
        { value: 'k18', labelFa: '۱۸', parentValue: 'gold' },
        { value: 'unknown', labelFa: 'نمی‌دانم', parentValue: null },
      ],
    });
    const material = def({ key: 'jewelry_material', labelFa: 'جنس', options: [{ value: 'gold', labelFa: 'طلا', parentValue: null }] });
    expect(dependentOptions(karat, material, undefined)).toEqual({
      kind: 'grouped',
      groups: [
        { value: '', labelFa: '', options: [karat.options[1]] },
        { value: 'gold', labelFa: 'طلا', options: [karat.options[0]] },
      ],
    });
    // Silver: only the loose option
    expect(dependentOptions(karat, material, 'silver')).toEqual({ kind: 'flat', options: [karat.options[1]] });
  });

  it('parentOf names a model’s make', () => {
    expect(parentOf(model, 'peugeot-other-model')).toBe('peugeot');
    expect(parentOf(model, 'nope')).toBeNull();
  });
});

describe('a model sent without its make (the grouped list, without JavaScript)', () => {
  const model208 = model.options.find((o) => o.parentValue === 'peugeot' && !o.value.endsWith('other-model'))!.value;

  it('brings its make along, so publishing works', () => {
    expect(validateAttributes([brand, model], { model: model208 }, 'publish')).toEqual({ ok: true, value: { brand: 'peugeot', model: model208 } });
  });

  it('a make that doesn’t match is still refused', () => {
    expect(validateAttributes([brand, model], { brand: 'bmw', model: model208 }, 'publish')).toEqual({ ok: false, errors: { model: 'parent_mismatch' } });
  });

  it('no model and no make is still missing both', () => {
    expect(validateAttributes([brand, model], {}, 'publish')).toEqual({ ok: false, errors: { brand: 'required', model: 'required' } });
  });

  it('an unknown model fills nothing', () => {
    expect(validateAttributes([brand, model], { model: 'nope' }, 'publish')).toEqual({ ok: false, errors: { brand: 'required', model: 'unknown_option' } });
  });
});
