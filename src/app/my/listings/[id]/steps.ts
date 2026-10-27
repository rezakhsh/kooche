import type { FieldErrors } from '../../../../modules/listings/listings';

// The posting steps (wave 1, mockups final/post1–post4): 1 category (/new), 2 photos and text,
// 3 details and price, 4 place and publishing. A draft is saved at each «ادامه»; the server says
// what publishing would still refuse, and the steps go on when none of it is in the step just left.

export type Step = 2 | 3 | 4;

/** The step a form field (or its error) belongs to */
export function stepOf(field: string): Step {
  if (field === 'title' || field === 'description' || field === 'kind') return 2;
  if (field.startsWith('attr.') || field === 'priceType' || field === 'amount' || field === 'shippingOffered') return 3;
  return 4;
}

/** The first step up to `through` that still has errors, else null */
export function firstStepWithErrors(errors: FieldErrors | undefined, through: Step): Step | null {
  const steps = Object.keys(errors ?? {}).map(stepOf).filter((s) => s <= through);
  return steps.length ? (Math.min(...steps) as Step) : null;
}
