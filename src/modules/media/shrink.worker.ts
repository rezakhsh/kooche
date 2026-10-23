import { shrinkWith, type ImageOps } from './shrink';

// The Web Worker that shrinks photos off the page (./shrink.ts), so a large photo doesn't freeze
// the form. Started by ./shrink-client.ts; same origin, allowed by `worker-src 'self'` in the CSP.

const ops: ImageOps<ImageBitmap> = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  },
  async draw(bitmap, { width, height }, type, quality) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    try {
      return await canvas.convertToBlob({ type, quality });
    } finally {
      // Frees the pixels at once instead of at the next garbage collection
      canvas.width = canvas.height = 0;
    }
  },
  close: (bitmap) => bitmap.close(),
};

self.onmessage = async (event: MessageEvent<{ id: number; file: File }>) => {
  const { id, file } = event.data;
  let blob: Blob | null = null;
  try {
    blob = await shrinkWith(file, ops);
  } catch {
    // Can't decode or too little memory: the page sends the original
  }
  self.postMessage({ id, blob });
};
