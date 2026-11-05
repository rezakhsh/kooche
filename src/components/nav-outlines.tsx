import type { ReactNode } from 'react';
import type { OutlineKind } from './nav-outline-kind';

// The grey outlines shown while a tapped page comes (src/components/nav-feedback.tsx). Each has the
// shape of its page: the same widths, paddings and breakpoints, so the page fills in where the
// shapes were. The listing and browse outlines follow the approved pictures
// (/root/peydoo-media/wave2/smooth-loading/png/combo/, style 4, Nov 5, 2026); the others are
// drawn the same way. `.sk` (globals.css) is the grey with the soft shimmer moving right to left.
// The data-* marks are the ones the real pages carry, so globals.css hides the same header and
// bottom bar while the outline shows.

/** A grey shape; text lines are short bars */
function B({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`sk block shrink-0 rounded-md ${className}`} />;
}

/** A white box like the app's cards */
function Box({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-neutral-200/60 bg-white ${className}`}>{children}</div>;
}

function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center gap-2 ${className}`}>{children}</div>;
}

function ListingOutline() {
  return (
    <main data-listing-page data-outline aria-busy className="mx-auto w-full max-w-6xl pb-28 sm:px-6 lg:pt-6 lg:pb-6">
      <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-8">
        <div className="min-w-0 space-y-5">
          <div className="relative">
            <span aria-hidden className="sk block aspect-[4/3] w-full sm:rounded-2xl lg:aspect-[16/10] lg:max-h-[440px]" />
            {/* Phones: back, share and ♡ over the photo, as on the page */}
            <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3 lg:hidden">
              <span className="flex size-11 items-center justify-center rounded-full bg-white/95 shadow"><B className="size-5 rounded-full" /></span>
              <span className="ms-auto flex size-11 items-center justify-center rounded-full bg-white/95 shadow"><B className="size-5 rounded-full" /></span>
              <span className="flex size-11 items-center justify-center rounded-full bg-white/95 shadow"><B className="size-5 rounded-full" /></span>
            </div>
          </div>
          <div className="space-y-5 px-4 sm:px-0">
            <Row className="gap-1.5">
              <B className="h-2.5 w-14" />
              <B className="size-2.5 rounded-full" />
              <B className="h-2.5 w-12" />
              <B className="size-2.5 rounded-full" />
              <B className="h-2.5 w-24" />
            </Row>
            <div className="space-y-3 lg:hidden">
              <B className="h-5 w-4/5" />
              <B className="h-7 w-28" />
              <Row>
                <B className="size-4 rounded-full" />
                <B className="h-3 w-1/2" />
              </Row>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex min-h-12 items-center gap-2 rounded-xl bg-neutral-50 px-3">
                  <B className="size-5 rounded-full" />
                  <B className="h-3 w-20" />
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-2xl bg-neutral-50 p-4 lg:hidden">
              <Row>
                <B className="size-5 rounded-full" />
                <B className="h-3.5 w-28" />
              </Row>
              <B className="h-3 w-11/12" />
              <B className="h-3 w-2/3" />
              <B className="h-3 w-5/6" />
            </div>
            <div className="hidden space-y-4 lg:block">
              <B className="h-4 w-24" />
              <B className="h-3 w-full" />
              <B className="h-3 w-1/2" />
              <B className="mt-8 h-4 w-20" />
              {[0, 1].map((i) => (
                <div key={i} className="flex justify-between border-b border-neutral-200 py-3">
                  <B className="h-3 w-16" />
                  <B className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="space-y-4">
            <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
              <B className="h-4 w-3/4" />
              <B className="h-4 w-1/2" />
              <B className="h-7 w-28" />
              <Row>
                <B className="size-4 rounded-full" />
                <B className="h-3 w-2/3" />
              </Row>
              <span aria-hidden className="flex h-11 items-center justify-center rounded-xl bg-neutral-50"><B className="h-3 w-32" /></span>
              <B className="h-2.5 w-3/5" />
              <span aria-hidden className="flex h-11 w-28 items-center justify-center rounded-xl border border-neutral-300"><B className="h-3 w-16" /></span>
            </section>
            <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
              <Row className="gap-3">
                <B className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <B className="h-3 w-24" />
                  <B className="h-3.5 w-16" />
                </div>
              </Row>
              <B className="h-2.5 w-full" />
              <B className="h-2.5 w-1/2" />
            </section>
            <section className="space-y-3 rounded-2xl bg-neutral-50 p-4">
              <B className="h-3.5 w-28" />
              <B className="h-3 w-11/12" />
              <B className="h-3 w-2/3" />
            </section>
          </div>
        </aside>
      </div>
      {/* Phones: the contact bar, so the bottom bar steps aside as on the page */}
      <div data-own-bar className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex gap-2">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-neutral-300"><B className="size-5 rounded-full" /></span>
          <span aria-hidden className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-50"><B className="h-3.5 w-36" /><B className="size-5 rounded-full" /></span>
        </div>
      </div>
    </main>
  );
}

function CardOutline() {
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/60 bg-white">
      <span aria-hidden className="sk block aspect-[4/3] rounded-none" />
      <div className="space-y-2.5 p-3">
        <B className="h-3.5 w-14" />
        <B className="h-3 w-full" />
        <B className="h-3 w-2/3" />
        <Row className="gap-1 pt-1">
          <B className="size-3 rounded-full" />
          <B className="h-2.5 w-1/2" />
        </Row>
      </div>
    </li>
  );
}

function BrowseOutline() {
  return (
    <main data-soft-page data-outline aria-busy className="mx-auto min-h-dvh w-full max-w-6xl pb-6 sm:px-6">
      {/* Phones: the search and the chip row */}
      <div className="sticky top-[57px] z-20 border-b border-neutral-200 bg-white px-4 pt-2.5 pb-2.5 lg:hidden">
        <span aria-hidden className="flex h-12 items-center rounded-2xl border border-neutral-300 px-4"><B className="size-5 rounded-full" /></span>
        <div className="mt-2.5 flex gap-2 overflow-hidden">
          {['w-20', 'w-20', 'w-28', 'w-16'].map((w, i) => (
            <span key={i} aria-hidden className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3.5">
              <B className="size-4 rounded-full" />
              <B className={`h-3 ${w}`} />
            </span>
          ))}
        </div>
      </div>
      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:pt-6">
        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          <Box className="space-y-4 p-4">
            <B className="h-2.5 w-16" />
            {['w-24', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20', 'w-28', 'w-20', 'w-16', 'w-24'].map((w, i) => (
              <Row key={i} className="justify-between">
                <Row>
                  <B className="size-4 rounded-full" />
                  <B className={`h-3 ${w}`} />
                </Row>
                <B className="h-2.5 w-3" />
              </Row>
            ))}
          </Box>
          <Box className="space-y-4 p-4">
            <B className="h-3.5 w-20" />
            <div className="grid grid-cols-2 gap-2">
              <span aria-hidden className="h-11 rounded-xl border border-neutral-300" />
              <span aria-hidden className="h-11 rounded-xl border border-neutral-300" />
            </div>
          </Box>
        </aside>
        <div className="min-w-0 px-4 sm:px-0">
          <Row className="mt-3 mb-3 justify-between lg:mt-1">
            <Row>
              <B className="h-4 w-28 lg:h-6 lg:w-40" />
              <B className="h-3 w-14" />
            </Row>
            <Row className="gap-3">
              <B className="h-3 w-16" />
              <span aria-hidden className="flex size-10 items-center justify-center rounded-xl border border-neutral-200 bg-white"><B className="size-5" /></span>
            </Row>
          </Row>
          <Box className="mb-3 flex items-center gap-3 p-2.5">
            <B className="size-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <B className="h-2.5 w-24" />
              <B className="h-3 w-40" />
            </div>
          </Box>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <CardOutline key={i} />
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}

function ListOutline() {
  return (
    <main data-outline aria-busy className="mx-auto min-h-dvh w-full max-w-3xl px-4 pt-5 pb-24">
      <Row className="justify-between">
        <B className="h-6 w-36" />
        <span aria-hidden className="h-11 w-28 rounded-xl bg-neutral-50" />
      </Row>
      <div className="mt-4 flex gap-2 overflow-hidden">
        {['w-16', 'w-20', 'w-16', 'w-14'].map((w, i) => (
          <span key={i} aria-hidden className="flex h-10 shrink-0 items-center rounded-full border border-neutral-200 px-3.5"><B className={`h-3 ${w}`} /></span>
        ))}
      </div>
      <ul className="mt-4 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i}>
            <Box className="flex gap-3 p-3">
              <B className="size-20 rounded-xl" />
              <div className="flex-1 space-y-2.5 py-1">
                <B className="h-3.5 w-3/4" />
                <B className="h-3.5 w-20" />
                <B className="h-2.5 w-1/3" />
              </div>
            </Box>
          </li>
        ))}
      </ul>
    </main>
  );
}

function ChatOutline() {
  return (
    <main data-outline aria-busy className="mx-auto min-h-dvh w-full max-w-3xl px-4 pt-5 pb-24">
      <B className="h-6 w-28" />
      <ul className="mt-4 divide-y divide-neutral-200">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <B className="size-14 rounded-xl" />
            <div className="flex-1 space-y-2.5">
              <Row className="justify-between">
                <B className="h-3.5 w-32" />
                <B className="h-2.5 w-10" />
              </Row>
              <B className="h-3 w-3/4" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

function ThreadOutline() {
  const bubbles: [boolean, string][] = [
    [false, 'w-48'],
    [true, 'w-40'],
    [false, 'w-56'],
    [true, 'w-32'],
  ];
  return (
    <main data-chat-thread data-outline aria-busy className="mx-auto flex h-dvh w-full max-w-3xl flex-col bg-white lg:border-x lg:border-neutral-200">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-2 py-1.5">
        <span aria-hidden className="flex size-11 items-center justify-center"><B className="size-5 rounded-full" /></span>
        <B className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <B className="h-3.5 w-32" />
          <B className="h-2.5 w-20" />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 bg-page px-4 py-4">
        {bubbles.map(([mine, w], i) => (
          <div key={i} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
            <span aria-hidden className={`sk block h-10 ${w} rounded-2xl`} />
          </div>
        ))}
      </div>
      <div data-own-bar className="flex items-center gap-2 border-t border-neutral-200 p-3">
        <span aria-hidden className="h-11 flex-1 rounded-2xl border border-neutral-300" />
        <B className="size-11 rounded-full" />
      </div>
    </main>
  );
}

function AccountOutline() {
  return (
    <main data-outline aria-busy className="mx-auto min-h-dvh w-full max-w-2xl px-4 pt-5 pb-24">
      <Row className="gap-3">
        <B className="size-14 rounded-full" />
        <div className="flex-1 space-y-2.5">
          <B className="h-4 w-32" />
          <B className="h-3 w-44" />
        </div>
      </Row>
      {[4, 3].map((n, s) => (
        <Box key={s} className="mt-5 divide-y divide-neutral-200">
          {Array.from({ length: n }, (_, i) => (
            <Row key={i} className="justify-between gap-3 px-4 py-4">
              <Row className="gap-3">
                <B className="size-5 rounded-full" />
                <B className={`h-3.5 ${i % 2 ? 'w-28' : 'w-36'}`} />
              </Row>
              <B className="size-3 rounded-full" />
            </Row>
          ))}
        </Box>
      ))}
    </main>
  );
}

function PostingOutline() {
  return (
    <>
      <div data-app-bar data-own-bar data-outline className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-1.5">
          <span aria-hidden className="flex size-11 items-center justify-center"><B className="size-5 rounded-full" /></span>
          <div className="flex-1 space-y-2">
            <B className="h-3.5 w-28" />
            <B className="h-2.5 w-40" />
          </div>
        </div>
      </div>
      <main aria-busy className="mx-auto min-h-dvh w-full max-w-2xl px-4 pt-4 pb-10 sm:px-6">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} aria-hidden className={`h-1.5 flex-1 rounded-full ${i === 0 ? 'sk' : 'bg-neutral-100'}`} />
          ))}
        </div>
        <B className="mt-6 h-5 w-48" />
        <div className="mt-6 space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2.5">
              <B className="h-3.5 w-24" />
              <span aria-hidden className="block h-12 rounded-xl border border-neutral-300" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <span aria-hidden className="h-12 rounded-xl border border-neutral-300" />
            <span aria-hidden className="h-12 rounded-xl border border-neutral-300" />
          </div>
        </div>
      </main>
    </>
  );
}

const OUTLINES: Record<OutlineKind, () => ReactNode> = {
  listing: ListingOutline,
  browse: BrowseOutline,
  list: ListOutline,
  chat: ChatOutline,
  thread: ThreadOutline,
  account: AccountOutline,
  posting: PostingOutline,
};

export function NavOutline({ kind }: { kind: OutlineKind }) {
  const Outline = OUTLINES[kind];
  return <Outline />;
}
