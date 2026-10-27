import type { FieldErrors } from '../../modules/listings/listings';

// The event posting steps (wave 1, mockups final/post-event1 and post-event2; step 3 designed in
// the same style): 1 poster, type and title, 2 time and place, 3 tickets, details and publishing.
// A draft is saved at each «ادامه»; the server says what publishing would still refuse, and the
// steps go on when none of it is in the step just left.

export type EventStep = 1 | 2 | 3;

const STEP_1 = new Set(['categoryId', 'title']);
const STEP_2 = new Set(['startDate', 'startTime', 'endDate', 'endTime', 'repeatUntil', 'venueName', 'streetAddress', 'onlineUrl', 'countryCode', 'place', 'area']);

/** The step a form field (or its error) belongs to */
export function eventStepOf(field: string): EventStep {
  if (STEP_1.has(field)) return 1;
  if (STEP_2.has(field)) return 2;
  return 3;
}

/** The first step up to `through` that still has errors, else null */
export function firstEventStepWithErrors(errors: FieldErrors | undefined, through: EventStep): EventStep | null {
  const steps = Object.keys(errors ?? {}).map(eventStepOf).filter((s) => s <= through);
  return steps.length ? (Math.min(...steps) as EventStep) : null;
}
