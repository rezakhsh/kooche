import { imageUrl } from '../../../modules/media/server';

// What the photo editor shows per photo. Not a server action: it signs URLs, so only server code
// that already found the owner's photos calls it.

export type PhotoView = {
  id: string;
  status: 'pending_upload' | 'processing' | 'ready' | 'rejected' | 'failed';
  thumb: string | null;
  /** Upright (4:5), for an event's poster in its posting steps */
  poster: string | null;
};

export function photoView(i: { id: string; status: PhotoView['status']; storageKey: string }): PhotoView {
  const ready = i.status === 'ready';
  return { id: i.id, status: i.status, thumb: ready ? imageUrl(i.storageKey, 'thumb', 'webp') : null, poster: ready ? imageUrl(i.storageKey, 'poster', 'webp') : null };
}
