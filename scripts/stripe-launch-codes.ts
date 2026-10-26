// One-use promotion codes for the free launch Pro (6 months, decided Oct 22, 2026), one per
// launch business. The business enters it in Stripe Checkout when it subscribes; its Pro then
// arrives through the webhook like everyone else's (docs/schema.md, section 16.2). Prints the codes.
//
//   STRIPE_SECRET_KEY=… npx tsx scripts/stripe-launch-codes.ts --count 10 [--expires-days 90]
//
// RETIRED in wave 0 (Oct 26, 2026): a 100% coupon on a normal subscription charges €24 by itself
// after 6 months. Founding businesses now get a trial without a card that simply ends
// (src/modules/payments/founding.ts, admin › businesses). Checkout no longer shows a code field.
// The script refuses unless --i-know-it-charges is given.

import { randomInt } from 'node:crypto';
import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '../src/modules/payments/gateway';
import { launchCoupon } from '../seed/products';

if (!process.argv.includes('--i-know-it-charges')) {
  throw new Error('retired: use founding Pro (admin › businesses) instead; see the comment at the top');
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error('STRIPE_SECRET_KEY is required');
const args = process.argv.slice(2);
const count = Number(args[args.indexOf('--count') + 1] ?? 0);
if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('--count 1–100');
const expiresDays = args.includes('--expires-days') ? Number(args[args.indexOf('--expires-days') + 1]) : 90;

const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
// No 0/O or 1/I, so a code read over the phone can't be mistyped
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => `PEYDOO-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`;

for (let i = 0; i < count; i++) {
  const created = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: launchCoupon.id },
    code: code(),
    max_redemptions: 1,
    expires_at: Math.floor(Date.now() / 1000) + expiresDays * 86_400,
    metadata: { purpose: 'launch' },
  });
  console.log(created.code);
}
