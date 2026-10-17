'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Icon } from '../../../../components/icons';
import { messages } from '../../../../messages/fa';

// The listing's photos: the cover large, small photos below, and a full-screen viewer (approved
// Oct 17, 2026). Tap or click any photo to open it; swipe or use the arrow keys to move; Esc, the
// close button, a click beside the photo or the phone's back button close it.
//
// No inline styles (the CSP allows none): the viewer is a native <dialog> (its backdrop is styled
// in globals.css), photos move by native horizontal scrolling with scroll snap, and the page
// behind is held still with a class. Without JavaScript every photo is a link to its large image.

export type GalleryImage = {
  id: string;
  /** imgproxy's large image, AVIF and WebP */
  full: { avif: string; webp: string } | null;
  thumb: string | null;
  /** ThumbHash as a data: image, shown while the photo loads */
  placeholder: string | null;
  width: number | null;
  height: number | null;
};

const VIEWER_HASH = '#photos';

export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const t = messages.listing;
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const total = images.length;
  const cover = images[0]!;

  const goTo = useCallback((i: number, smooth = true) => {
    const slide = track.current?.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', inline: 'center', block: 'nearest' });
  }, []);

  const show = (i: number) => (e: MouseEvent) => {
    e.preventDefault();
    setIndex(i);
    setOpen(true);
  };

  // Opening: the modal dialog, the page held still, and a history entry so "back" closes it
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.classList.add('overflow-hidden');
      if (location.hash !== VIEWER_HASH) history.pushState(null, '', `${location.pathname}${location.search}${VIEWER_HASH}`);
      requestAnimationFrame(() => goTo(index, false));
    } else if (!open && d.open) {
      d.close();
    }
    // `index` only matters when opening
  }, [open, goTo]);

  useEffect(() => {
    const onPop = () => {
      if (location.hash !== VIEWER_HASH) setOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** Every way of closing ends here (the dialog's own close event) */
  function onClose() {
    document.documentElement.classList.remove('overflow-hidden');
    setOpen(false);
    if (location.hash === VIEWER_HASH) history.back();
  }

  function onScroll() {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    // Right to left: scrollLeft runs from 0 to negative values
    setIndex(Math.min(total - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth)));
  }

  function onKeyDown(e: KeyboardEvent) {
    // The page reads right to left: the left arrow moves forward
    if (e.key === 'ArrowLeft') goTo(Math.min(total - 1, index + 1));
    else if (e.key === 'ArrowRight') goTo(Math.max(0, index - 1));
  }

  return (
    <div className="flex flex-col gap-2">
      <a
        href={cover.full?.webp ?? '#'}
        onClick={show(0)}
        aria-label={`${t.openViewer}: ${t.photo(1, total)}`}
        className="group relative block aspect-[4/3] cursor-zoom-in overflow-hidden bg-neutral-100 sm:rounded-2xl"
      >
        <Picture image={cover} alt={title} priority className="object-contain" />
        <span className="absolute bottom-3 start-3 flex items-center gap-1 rounded-lg bg-neutral-900/70 px-2 py-0.5 text-xs text-white">
          <Icon name="camera" className="size-3.5" />
          {t.counter(1, total)}
        </span>
        <span className="absolute end-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm transition-transform group-hover:scale-110">
          <Icon name="expand" className="size-4" />
        </span>
      </a>
      {total > 1 && (
        <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 sm:px-0">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <a
                href={img.full?.webp ?? '#'}
                onClick={show(i)}
                aria-label={`${t.openViewer}: ${t.photo(i + 1, total)}`}
                className="block size-16 overflow-hidden rounded-xl bg-neutral-100 ring-brand-700 hover:ring-2 focus-visible:ring-2 sm:size-20"
              >
                {img.thumb ? (
                  <img src={img.thumb} alt="" width={160} height={160} loading="lazy" decoding="async" className="size-full object-cover" />
                ) : img.placeholder ? (
                  <img src={img.placeholder} alt="" className="size-full object-cover" />
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        onClose={onClose}
        onKeyDown={onKeyDown}
        aria-label={t.viewer}
        className="photo-viewer m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-white"
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-sm">
              <span aria-live="polite">{t.counter(index + 1, total)}</span>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="flex size-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                aria-label={t.closeViewer}
                autoFocus
              >
                <Icon name="close" className="size-5" />
              </button>
            </div>
            <div ref={track} onScroll={onScroll} className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
              {images.map((img, i) => (
                <div
                  key={img.id}
                  onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
                  className="flex h-full w-full shrink-0 snap-center items-center justify-center sm:px-16"
                >
                  <Picture image={img} alt={t.photo(i + 1, total)} className="max-h-full max-w-full object-contain" viewer />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => goTo(Math.max(0, index - 1))}
                disabled={index === 0}
                className="hidden size-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 sm:flex"
                aria-label={t.previous}
              >
                <Icon name="chevronStart" className="size-5" />
              </button>
              <div className="flex gap-1.5" aria-hidden>
                {images.map((img, i) => (
                  <span key={img.id} className={`size-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/35'}`} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => goTo(Math.min(total - 1, index + 1))}
                disabled={index === total - 1}
                className="hidden size-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 sm:flex"
                aria-label={t.next}
              >
                <Icon name="chevronEnd" className="size-5" />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

/** AVIF with a WebP fallback, over the ThumbHash placeholder (a data: image, not a style) */
function Picture({ image, alt, priority, viewer, className = '' }: { image: GalleryImage; alt: string; priority?: boolean; viewer?: boolean; className?: string }) {
  if (viewer) {
    return image.full ? (
      <picture className="contents">
        <source srcSet={image.full.avif} type="image/avif" />
        <img src={image.full.webp} alt={alt} width={image.width ?? undefined} height={image.height ?? undefined} decoding="async" className={className} />
      </picture>
    ) : null;
  }
  return (
    <>
      {image.placeholder && <img src={image.placeholder} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover blur-lg" />}
      {image.full && (
        <picture>
          <source srcSet={image.full.avif} type="image/avif" />
          <img
            src={image.full.webp}
            alt={alt}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            className={`relative size-full ${className}`}
          />
        </picture>
      )}
    </>
  );
}
