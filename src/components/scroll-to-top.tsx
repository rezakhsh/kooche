'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// A tapped link to another page opens it at the top. Next.js skips its own scroll when the new
// page's first element already looks in view, and signed-in pages opened from far down a long page
// came up cut off at the top (the owner's production test, Nov 3, 2026). Only after a tap on a
// link: back and forward keep the browser's place, links with a #section keep their jump, and the
// posting steps' address changes (history.replaceState) move nothing.

export function ScrollToTop() {
  const pathname = usePathname();
  /** When a link to another page was tapped; a tap whose page never came (a link that only opens something) runs out */
  const tapped = useRef<number | null>(null);

  useEffect(() => {
    // Capture phase: Next's <Link> cancels the click before it would bubble up here
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash || url.pathname === window.location.pathname) return;
      tapped.current = Date.now();
    };
    const onPop = () => {
      tapped.current = null;
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  useEffect(() => {
    const at = tapped.current;
    tapped.current = null;
    if (at === null || Date.now() - at > 15_000) return;
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
