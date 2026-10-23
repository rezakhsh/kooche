import { shrinkPhoto, shrinkWith, type ImageOps } from './shrink';

// Shrinking in the browser (./shrink.ts): in a Web Worker on an OffscreenCanvas where the browser
// has both, else on the page with a <canvas> (Safari before 16.4). Without createImageBitmap,
// every photo goes as it is.

/** The same steps on the page, for browsers without OffscreenCanvas or when the worker won't start */
const pageOps: ImageOps<ImageBitmap> = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  },
  draw(bitmap, { width, height }, type, quality) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          canvas.width = canvas.height = 0;
          if (blob) resolve(blob);
          else reject(new Error('encode failed'));
        },
        type,
        quality,
      );
    });
  },
  close: (bitmap) => bitmap.close(),
};

export type Shrinker = { shrink(file: File): Promise<File>; close(): void };

/** One shrinker per batch of photos; close() stops its worker */
export function createShrinker(): Shrinker {
  if (typeof createImageBitmap !== 'function') return { shrink: async (file) => file, close() {} };
  const workerSupported = typeof Worker === 'function' && typeof OffscreenCanvas === 'function';

  let worker: Worker | null = null;
  /** The worker never answered (blocked or broken): use the page from now on */
  let usePage = !workerSupported;
  let answered = false;
  let nextId = 0;
  const pending = new Map<number, { file: File; resolve: (blob: Promise<Blob | null> | Blob | null) => void }>();

  function stopWorker() {
    worker?.terminate();
    worker = null;
    for (const job of pending.values()) job.resolve(usePage ? shrinkWith(job.file, pageOps) : null);
    pending.clear();
  }

  function startWorker(): Worker {
    const w = new Worker(new URL('./shrink.worker.ts', import.meta.url));
    w.onmessage = (event: MessageEvent<{ id: number; blob: Blob | null }>) => {
      answered = true;
      pending.get(event.data.id)?.resolve(event.data.blob);
      pending.delete(event.data.id);
    };
    w.onerror = () => {
      // A worker that failed before its first answer didn't load (CSP, old browser): its photos
      // go through the page instead. One that failed later crashed on a photo (memory), which
      // the page would hit too, so that photo goes as it is.
      if (!answered) usePage = true;
      stopWorker();
    };
    return w;
  }

  function inWorker(file: File): Promise<Blob | null> {
    try {
      worker ??= startWorker();
    } catch {
      usePage = true;
      return shrinkWith(file, pageOps);
    }
    const id = nextId++;
    const w = worker;
    return new Promise((resolve) => {
      pending.set(id, { file, resolve });
      w.postMessage({ id, file });
    });
  }

  return {
    async shrink(file) {
      const result = await shrinkPhoto(file, (f) => (usePage ? shrinkWith(f, pageOps) : inWorker(f)));
      // Timed out with the worker still busy: start a fresh one for the next photo
      if (pending.size > 0 && result === file) stopWorker();
      return result;
    },
    close: stopWorker,
  };
}
