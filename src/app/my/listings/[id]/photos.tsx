'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../../components/icons';
import { Alert, Card } from '../../../../components/ui';
import { messages } from '../../../../messages/fa';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from '../../../../modules/media/limits';
import { createShrinker, type Shrinker } from '../../../../modules/media/shrink-client';
import {
  confirmUploadAction,
  moveImageAction,
  photosAction,
  removeImageAction,
  requestUploadAction,
} from '../actions';
import type { PhotoView } from '../photo-view';

// The photo editor. Each photo is first shrunk in the browser to at most 2560 px (or sent as it
// is when that fails, see modules/media/shrink.ts), then goes straight to R2 through a presigned
// PUT; the server only hands out the URL and then learns that the upload is done. While the worker processes a
// photo, the list asks the server again every two seconds.
// Wave 1 (mockup final/post2): a big «افزودن عکس» tile in the grid, and each photo's actions
// (main photo, earlier, later, remove) in a ⋯ menu instead of four links under it.

const t = messages.form;
const POLL_MS = 2_000;

type Local = { tempId: string; preview: string; error?: string };

export function PhotoEditor({
  listingId,
  ensureListing,
  max,
  initial,
  enabled,
  onPhotos,
  bare = false,
  poster = false,
}: {
  /** null until the listing is saved or gets its first photo */
  listingId: string | null;
  /** Starts the draft for a listing nobody saved yet and returns its id */
  ensureListing: () => Promise<string>;
  max: number;
  initial: PhotoView[];
  enabled: boolean;
  /** The listing's photos (thumbnails, null while processing), for the check before publishing */
  onPhotos?: (thumbs: (string | null)[]) => void;
  /** In the posting steps the photos sit on the page, under the step's lead (mockup final/post2) */
  bare?: boolean;
  /** An event (mockup final/post-event1): the poster big and upright, «عکس‌های بیشتر» beside it */
  poster?: boolean;
}) {
  const [photos, setPhotos] = useState(initial);
  useEffect(() => onPhotos?.(photos.map((p) => p.thumb ?? null)), [photos, onPhotos]);
  const [uploading, setUploading] = useState<Local[]>([]);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const busy = photos.some((p) => p.status === 'pending_upload' || p.status === 'processing');
  useEffect(() => {
    if (!busy || !listingId) return;
    const timer = setInterval(async () => {
      try {
        setPhotos(await photosAction(listingId));
      } catch {
        // Offline for a moment: try again on the next tick
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [busy, listingId]);

  async function refresh(id = listingId) {
    if (id) setPhotos(await photosAction(id));
  }

  async function uploadOne(id: string, original: File, local: Local, shrinker: Shrinker) {
    const file = await shrinker.shrink(original);
    if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) throw new Error(t.photoBadType);
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(t.photoTooLarge);
    const ticket = await requestUploadAction({ listingId: id, contentType: file.type, size: file.size });
    if (!ticket.ok) throw new Error(ticket.error);
    const res = await fetch(ticket.url, { method: 'PUT', body: file, headers: ticket.headers });
    if (!res.ok) throw new Error(t.photoUploadFailed);
    if (!(await confirmUploadAction(ticket.imageId))) throw new Error(t.photoUploadFailed);
    URL.revokeObjectURL(local.preview);
  }

  async function onFiles(files: FileList | null) {
    setError(null);
    if (!files?.length) return;
    const room = max - photos.length - uploading.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > chosen.length) setError(t.photoTooMany);

    if (chosen.length === 0) return;
    let id: string;
    try {
      id = listingId ?? (await ensureListing());
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.genericError);
      return;
    }
    const locals = chosen.map((f) => ({ tempId: crypto.randomUUID(), preview: URL.createObjectURL(f) }));
    setUploading((u) => [...u, ...locals]);
    // One after another: phones on mobile data do better than with parallel uploads
    const shrinker = createShrinker();
    try {
      for (const [i, file] of chosen.entries()) {
        const local = locals[i]!;
        try {
          await uploadOne(id, file, local, shrinker);
          setUploading((u) => u.filter((x) => x.tempId !== local.tempId));
        } catch (e) {
          setUploading((u) => u.map((x) => (x.tempId === local.tempId ? { ...x, error: e instanceof Error ? e.message : t.photoUploadFailed } : x)));
        }
        await refresh(id);
      }
    } finally {
      shrinker.close();
    }
    if (input.current) input.current.value = '';
  }

  async function act(fn: () => Promise<boolean>) {
    setError(null);
    if (!(await fn())) setError(messages.genericError);
    await refresh();
  }

  const full = photos.length + uploading.filter((u) => !u.error).length >= max;
  const picker = (
    <input ref={input} type="file" accept={ACCEPTED_TYPES.join(',')} multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
  );

  const menuItem = 'flex min-h-11 w-full items-center px-3 text-start text-sm hover:bg-neutral-50';
  const Box = bare ? 'div' : Card;
  return (
    <Box className="space-y-3">
      {!bare && <h2 className="font-semibold">{t.photos}</h2>}
      {!bare && <p className="text-xs leading-relaxed text-neutral-600">{t.photosHint(max)}</p>}
      {!enabled && <Alert tone="info">{t.photosUnavailable}</Alert>}
      {poster && (
        <div className="grid grid-cols-[9rem_1fr] gap-3">
          {photos[0] || uploading[0] ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-100">
              {photos[0]?.poster ? (
                <img src={photos[0].poster} alt="" width={144} height={180} className="size-full object-cover" />
              ) : uploading[0] && !photos[0] ? (
                <img src={uploading[0].preview} alt="" className="size-full object-cover opacity-50" />
              ) : (
                <span className="flex size-full items-center justify-center p-2 text-center text-xs text-neutral-600">
                  {photos[0]?.status === 'rejected' ? t.photoRejected : photos[0]?.status === 'failed' ? t.photoFailed : t.processing}
                </span>
              )}
              {photos[0] && (
                <button type="button" onClick={() => act(() => removeImageAction(photos[0]!.id))} aria-label={t.removePhoto} title={t.removePhoto} className="absolute end-1.5 bottom-1.5 flex size-8 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-sm">
                  <Icon name="trash" className="size-4" />
                </button>
              )}
            </div>
          ) : (
            <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/50 text-center text-brand-800 hover:bg-brand-50">
              <Icon name="image" className="size-7" />
              <b className="text-sm">{messages.events.steps.addPoster}</b>
              {enabled && picker}
            </label>
          )}
          <div className="flex flex-col gap-2">
            {photos.length + uploading.length > 0 && enabled && !full && (
              <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/50 text-sm font-bold text-brand-800 hover:bg-brand-50">
                <Icon name="camera" className="size-6" />
                {messages.events.steps.morePhotos}
                {picker}
              </label>
            )}
            <p className="text-xs leading-6 text-neutral-600">{messages.events.steps.morePhotosHint}</p>
          </div>
        </div>
      )}
      <ul className={poster ? (photos.length + uploading.length > 1 ? 'grid grid-cols-4 gap-2' : 'hidden') : 'grid grid-cols-3 gap-2'}>
        {(poster ? photos.slice(1) : photos).map((p, j) => {
          const i = poster ? j + 1 : j;
          return (
          <li key={p.id} className="relative aspect-square overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
            {p.thumb ? (
              <img src={p.thumb} alt="" width={160} height={160} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center p-2 text-center text-xs text-neutral-600">
                {p.status === 'rejected' ? t.photoRejected : p.status === 'failed' ? t.photoFailed : t.processing}
              </span>
            )}
            {i === 0 && p.status === 'ready' && (
              <span className="absolute start-1.5 top-1.5 rounded-md bg-saffron-500 px-1.5 text-xs font-bold leading-5 text-neutral-900">{t.cover}</span>
            )}
            <details className="absolute end-1 bottom-1">
              <summary aria-label={t.photoActions} className="flex size-11 cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden">
                <span className="flex size-8 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-sm">
                  <Icon name="more" className="size-4" />
                </span>
              </summary>
              <div className="absolute end-0 bottom-full z-20 mb-1 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                {i > 0 && (
                  <button type="button" className={menuItem} onClick={() => act(() => moveImageAction(p.id, 'first'))}>
                    {t.makeCover}
                  </button>
                )}
                {i > 0 && (
                  <button type="button" className={menuItem} onClick={() => act(() => moveImageAction(p.id, 'earlier'))}>
                    {t.moveEarlier}
                  </button>
                )}
                {i < photos.length - 1 && (
                  <button type="button" className={menuItem} onClick={() => act(() => moveImageAction(p.id, 'later'))}>
                    {t.moveLater}
                  </button>
                )}
                <button type="button" className={`${menuItem} text-red-700`} onClick={() => act(() => removeImageAction(p.id))}>
                  {t.removePhoto}
                </button>
              </div>
            </details>
          </li>
          );
        })}
        {(poster ? uploading.slice(photos.length ? 0 : 1) : uploading).map((u) => (
          <li key={u.tempId} className="relative aspect-square overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
            <img src={u.preview} alt="" className="size-full object-cover opacity-50" />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-xs">
              {u.error ?? t.uploading}
              {u.error && (
                <button type="button" className="min-h-11 text-xs font-bold text-neutral-700 underline" onClick={() => setUploading((x) => x.filter((y) => y.tempId !== u.tempId))}>
                  {messages.my.cancel}
                </button>
              )}
            </span>
          </li>
        ))}
        {enabled && !full && !poster && (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/50 text-brand-800 hover:bg-brand-50">
              <Icon name="camera" className="size-7" />
              <b className="text-sm">{t.addPhotos}</b>
              {picker}
            </label>
          </li>
        )}
      </ul>
      {photos.length > 1 && <p className="text-xs text-neutral-600">{t.photoMenuHint}</p>}
      {error && <Alert tone="error">{error}</Alert>}
    </Box>
  );
}
