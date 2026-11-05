'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { messages } from '../messages/fa';
import { outlineFor, type OutlineKind } from './nav-outline-kind';
import { NavOutline } from './nav-outlines';

// Smooth loading (docs/research/smooth-loading.md, style 4, approved by the owner Nov 5, 2026):
// the moment a link inside the site is tapped, a thin turquoise line starts at the top and the
// page area turns into grey outlines of the coming page; both go when the new page arrives.
//
// Why here and not in loading.tsx files: a loading.tsx makes every direct page load start
// streaming before the page has run, which fixes the status at 200, so our 308 redirects
// (canonical browse addresses, old slugs) and 404s would turn into in-page redirects and soft
// 404s. This layer only acts on taps inside an open page, so the server answers exactly as before.
//
// A tap counts when Next.js's <Link> took it over (defaultPrevented): same origin, plain click,
// another address. Back and forward come from Next.js's memory at once and get nothing. While a
// listing loads, its big photo starts downloading too (data-photo on the card), and a mouse that
// rests on a card fetches it ahead.

type Pending = { from: string; kind: OutlineKind | null };

const SAFETY_MS = 15_000;
const HOVER_MS = 120;

function here(): string {
  return location.pathname + location.search;
}

function warmPhoto(url: string | undefined, warmed: Set<string>) {
  if (!url || warmed.has(url) || warmed.size > 60) return;
  warmed.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

function Feedback({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = pathname + (search ? `?${search}` : '');
  const [pending, setPending] = useState<Pending | null>(null);
  const warmed = useRef(new Set<string>());

  // The new page has arrived (or the address changed some other way): everything goes
  const active = pending && pending.from === current ? pending : null;
  useEffect(() => {
    if (pending && pending.from !== current) setPending(null);
  }, [current, pending]);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), SAFETY_MS);
    const reset = () => setPending(null);
    // Back from another site (the browser's page cache) or a full page load
    addEventListener('pageshow', reset);
    addEventListener('popstate', reset);
    return () => {
      clearTimeout(t);
      removeEventListener('pageshow', reset);
      removeEventListener('popstate', reset);
    };
  }, [pending]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Bubbling phase on the document: React's handlers (Next's <Link>) have already run
      if (!e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      const to = url.pathname + url.search;
      if (to === here()) return; // the same page, or only a #part of it
      warmPhoto(a.dataset.photo, warmed.current);
      // The admin page has its own sections and no public outlines
      const kind = document.querySelector('[data-admin]') ? null : outlineFor(url.pathname);
      setPending({ from: here(), kind });
      if (kind) scrollTo({ top: 0, behavior: 'instant' });
    };
    // A mouse resting on a listing card: its photo comes ahead (phones download it on the tap)
    let hover: ReturnType<typeof setTimeout> | null = null;
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const a = (e.target as Element | null)?.closest?.('a[data-photo]');
      if (hover) clearTimeout(hover);
      if (a instanceof HTMLAnchorElement) hover = setTimeout(() => warmPhoto(a.dataset.photo, warmed.current), HOVER_MS);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('pointerover', onOver, { passive: true });
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerover', onOver);
      if (hover) clearTimeout(hover);
    };
  }, []);

  return (
    <>
      {active && <div data-nav-line className="nav-line" role="progressbar" aria-label={messages.nav.loading} />}
      {active?.kind ? <NavOutline kind={active.kind} /> : children}
    </>
  );
}

/** Wraps the page area in the root layout */
export function NavFeedback({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <Feedback>{children}</Feedback>
    </Suspense>
  );
}
