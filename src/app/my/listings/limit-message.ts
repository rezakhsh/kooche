import { messages } from '../../../messages/fa';

// The text for a refusal by the private and business limits (src/modules/organizations/limits.ts),
// for the posting form's error and «آگهی‌های من» after renewing or resuming.

const t = messages.business.limits;

const TEXTS: Record<string, string> = {
  business_only: t.businessOnly,
  licence_required: t.licenceRequired,
  private_service_limit: t.privateServices,
  private_property_limit: t.privateProperty,
  private_car_limit: t.privateCars,
  private_goods_limit: t.privateGoods,
  business_limit: t.businessListings,
  legal_missing: t.legalMissing,
  not_member: t.notMember,
};

/** The text for a limit refusal, or null for any other reason */
export function limitMessage(reason: string): string | null {
  return TEXTS[reason] ?? null;
}
