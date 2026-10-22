import { z } from 'zod';

// Limits of a Pro plan (products.features, copied onto each pro_plan entitlement so a business
// keeps what it bought even if the product changes later; docs/schema.md, section 12).

export const planFeaturesSchema = z.object({
  /** Active business listings at once */
  activeListings: z.int().min(1).max(10_000),
  /** Bumps included per 30 days, on monthly and yearly plans alike */
  bumpsPerMonth: z.int().min(0).max(1_000),
  /** Listings featured at once from the plan */
  featuredSlots: z.int().min(0).max(100),
  /** Members besides the owner */
  staffSeats: z.int().min(0).max(100),
});
export type PlanFeatures = z.infer<typeof planFeaturesSchema>;

/** A business without Pro (decided Oct 22, 2026): 3 active listings, no staff, nothing included */
export const FREE_BUSINESS: PlanFeatures = { activeListings: 3, bumpsPerMonth: 0, featuredSlots: 0, staffSeats: 0 };

/** The plan's limits, or the free quota when the stored value doesn't parse */
export function planFeatures(value: unknown): PlanFeatures {
  const parsed = planFeaturesSchema.safeParse(value);
  return parsed.success ? parsed.data : FREE_BUSINESS;
}
