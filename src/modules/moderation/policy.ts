// The review hook (decided Oct 17, 2026). Listings go live as soon as they are published, and the
// automatic post-checks in the worker (./checks.ts) can take them down afterwards. Editing an
// active listing keeps it live and runs the same post-checks.
//
// Phase 4 changes this one function: return 'hold' for the cases that need a look first (new
// accounts, risky categories with categories.requires_review, a low trust score). A held listing
// goes to pending_review, which the worker's checks and later the AI review and the human
// moderation queue (listings_review_queue_idx) decide on. Until then categories.requires_review
// is not read anywhere.

export type ReviewPolicy = 'publish' | 'hold';

export type ReviewContext = {
  categoryId: string;
  userId: string;
  /** A listing the checks took down and the seller edited and sent again */
  resubmission: boolean;
};

export function reviewPolicy(ctx: ReviewContext): ReviewPolicy {
  // A taken-down listing is checked before it goes live again, so it can't be flipped back up
  // unchanged.
  return ctx.resubmission ? 'hold' : 'publish';
}
