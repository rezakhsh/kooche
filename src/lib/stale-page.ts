import { unstable_isUnrecognizedActionError } from 'next/navigation';

// A page opened before a deploy still carries the old build's server action ids; Next.js changes
// them with every build, so the new server answers "action not found" and the call throws
// (UnrecognizedActionError). Seen on staging, Nov 7, 2026: the owner's logo upload right after a
// deploy failed with «بارگذاری نشد». Only a fresh page helps.

/** Whether a server action failed because this page is older than the running build */
export function isStalePage(error: unknown): boolean {
  return unstable_isUnrecognizedActionError(error);
}

const RELOADED = 'stale-page-reload';

/**
 * Loads the page again, once per minute at most (a server that keeps refusing must not loop the
 * page). Returns false when it already did, so the caller shows its error instead.
 */
export function reloadStalePage(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOADED, String(Date.now()));
  } catch {
    // No storage (private mode): reload anyway, a loop then needs a server that keeps refusing
  }
  window.location.reload();
  return true;
}
