'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Card } from '../../../../components/ui';
import { messages } from '../../../../messages/fa';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from '../../../../modules/media/limits';
import {
  confirmUploadAction,
  moveImageAction,
  photosAction,
  removeImageAction,
  requestUploadAction,
} from '../actions';
import type { PhotoView } from '../photo-view';

// The photo editor. Files go from the browser straight to R2 through a presigned PUT; the server
// only hands out the URL and then learns that the upload is done. While the worker processes a
// photo, the list asks the server again every two seconds.

const t = messages.form;
const POLL_MS = 2_000;

type Local = { tempId: string; preview: string; error?: string };

export function PhotoEditor({
  listingId,
  ensureListing,
  max,
  initial,
  enabled,
}: {
  /** null until the listing is saved or gets its first photo */
  listingId: string | null;
  /** Starts the draft for a listing nobody saved yet and returns its id */
  ensureListing: () => Promise<string>;
  max: number;
  initial: PhotoView[];
  enabled: boolean;
}) {
  const [photos, setPhotos] = useState(initial);
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

  async function uploadOne(id: string, file: File, local: Local) {
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
    for (const [i, file] of chosen.entries()) {
      const local = locals[i]!;
      try {
        if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) throw new Error(t.photoBadType);
        if (file.size > MAX_UPLOAD_BYTES) throw new Error(t.photoTooLarge);
        await uploadOne(id, file, local);
        setUploading((u) => u.filter((x) => x.tempId !== local.tempId));
      } catch (e) {
        setUploading((u) => u.map((x) => (x.tempId === local.tempId ? { ...x, error: e instanceof Error ? e.message : t.photoUploadFailed } : x)));
      }
      await refresh(id);
    }
    if (input.current) input.current.value = '';
  }

  async function act(fn: () => Promise<boolean>) {
    setError(null);
    if (!(await fn())) setError(messages.genericError);
    await refresh();
  }

  const full = photos.length + uploading.filter((u) => !u.error).length >= max;

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{t.photos}</h2>
      <p className="text-xs leading-relaxed text-neutral-500">{t.photosHint(max)}</p>
      {!enabled && <Alert tone="info">{t.photosUnavailable}</Alert>}
      <ul className="grid grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <li key={p.id} className="space-y-1">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
              {p.thumb ? (
                <img src={p.thumb} alt="" width={160} height={160} className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center p-2 text-center text-xs text-neutral-600">
                  {p.status === 'rejected' ? t.photoRejected : p.status === 'failed' ? t.photoFailed : t.processing}
                </span>
              )}
              {i === 0 && p.status === 'ready' && (
                <span className="absolute start-1 top-1 rounded-md bg-emerald-700 px-1.5 py-0.5 text-[10px] text-white">{t.cover}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-2 text-[11px]">
              {i > 0 && (
                <button type="button" className="text-emerald-800 underline" onClick={() => act(() => moveImageAction(p.id, 'first'))}>
                  {t.makeCover}
                </button>
              )}
              {i > 0 && (
                <button type="button" className="text-neutral-600 underline" onClick={() => act(() => moveImageAction(p.id, 'earlier'))}>
                  {t.moveEarlier}
                </button>
              )}
              {i < photos.length - 1 && (
                <button type="button" className="text-neutral-600 underline" onClick={() => act(() => moveImageAction(p.id, 'later'))}>
                  {t.moveLater}
                </button>
              )}
              <button type="button" className="text-red-700 underline" onClick={() => act(() => removeImageAction(p.id))}>
                {t.removePhoto}
              </button>
            </div>
          </li>
        ))}
        {uploading.map((u) => (
          <li key={u.tempId} className="space-y-1">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
              <img src={u.preview} alt="" className="size-full object-cover opacity-50" />
              <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs">
                {u.error ?? t.uploading}
              </span>
            </div>
            {u.error && (
              <button
                type="button"
                className="text-[11px] text-neutral-600 underline"
                onClick={() => setUploading((x) => x.filter((y) => y.tempId !== u.tempId))}
              >
                {messages.my.cancel}
              </button>
            )}
          </li>
        ))}
      </ul>
      {enabled && !full && (
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
          {t.addPhotos}
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  );
}
