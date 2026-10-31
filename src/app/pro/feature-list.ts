import { messages } from '../../messages/fa';
import type { PlanFeatures } from '../../modules/payments/features';

/** What a plan includes, as the Pro page and the business's plans page list it */
export function planFeatureList(code: 'free' | 'pro' | 'pro-plus', features: PlanFeatures): string[] {
  const f = messages.pro.features;
  if (code === 'free') return [f.listings(features.activeListings), f.page, f.bumps(0)];
  const list = [f.listings(features.activeListings), f.bumps(features.bumpsPerMonth), f.featured(features.featuredSlots), f.staff(features.staffSeats)];
  return (code === 'pro' ? [...list, f.badge, f.stats] : [...list, f.allPro]).filter((x): x is string => !!x);
}
