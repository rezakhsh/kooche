import type { AttributeDef, AttributeOption } from './catalog';

// The options of a dependent select in the posting form (model depends on brand, karat on
// material). Once the parent is chosen: that parent's options only. Before: every option, grouped
// under its parent's name, so the field opens and works without JavaScript too; choosing one
// fills the parent (in the form with JavaScript, on the server without).

export type DependentOptions =
  | { kind: 'flat'; options: AttributeOption[] }
  | { kind: 'grouped'; groups: { value: string; labelFa: string; options: AttributeOption[] }[] };

export function dependentOptions(def: AttributeDef, parent: AttributeDef | undefined, parentValue: string | undefined): DependentOptions {
  if (!def.dependsOn) return { kind: 'flat', options: def.options };
  if (parentValue) return { kind: 'flat', options: def.options.filter((o) => !o.parentValue || o.parentValue === parentValue) };
  // In the parent's order; options without a parent stay ungrouped, first
  const loose = def.options.filter((o) => !o.parentValue);
  const groups = (parent?.options ?? [])
    .map((p) => ({ value: p.value, labelFa: p.labelFa, options: def.options.filter((o) => o.parentValue === p.value) }))
    .filter((g) => g.options.length > 0);
  if (!groups.length) return { kind: 'flat', options: def.options };
  return loose.length ? { kind: 'grouped', groups: [{ value: '', labelFa: '', options: loose }, ...groups] } : { kind: 'grouped', groups };
}

/** The parent value an option belongs to (a model's brand), or null */
export function parentOf(def: AttributeDef, value: string): string | null {
  return def.options.find((o) => o.value === value)?.parentValue ?? null;
}
