import { AwsClient } from 'aws4fetch';

// Object storage over the S3 API: Cloudflare R2 (EU jurisdiction) on the server. The database
// stores keys only; endpoint and bucket come from the environment (CLAUDE.md). aws4fetch signs
// requests with SigV4 in a few kilobytes, instead of the AWS SDK.

export type PresignedPut = { url: string; headers: Record<string, string> };

export interface ObjectStorage {
  /**
   * A one-time upload URL. Content-Type and Content-Length are part of the signature, so R2
   * refuses a file of another size or type (R2 has no presigned POST with a size range).
   */
  presignPut(key: string, opts: { contentType: string; contentLength: number; expiresSeconds: number }): Promise<PresignedPut>;
  /** The object's bytes, or null if it doesn't exist */
  get(key: string, maxBytes: number): Promise<Buffer | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Deleting a missing object is not an error */
  delete(key: string): Promise<void>;
}

export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export class ObjectTooLargeError extends Error {}

export function s3Storage(config: S3Config): ObjectStorage {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: config.region,
  });
  const base = `${config.endpoint.replace(/\/$/, '')}/${config.bucket}`;
  const url = (key: string) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;

  return {
    async presignPut(key, { contentType, contentLength, expiresSeconds }) {
      const headers = { 'Content-Type': contentType, 'Content-Length': String(contentLength) };
      const signed = await client.sign(`${url(key)}?X-Amz-Expires=${expiresSeconds}`, {
        method: 'PUT',
        headers,
        // aws4fetch leaves Content-Length out of the signature unless told to sign every header
        aws: { signQuery: true, allHeaders: true },
      });
      // The browser sets Content-Length itself from the file; only Content-Type is sent by hand
      return { url: signed.url, headers: { 'Content-Type': contentType } };
    },
    async get(key, maxBytes) {
      const res = await client.fetch(url(key));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`storage: GET failed with ${res.status}`);
      const length = Number(res.headers.get('content-length') ?? NaN);
      if (length > maxBytes) {
        await res.body?.cancel();
        throw new ObjectTooLargeError(`object is ${length} bytes`);
      }
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length > maxBytes) throw new ObjectTooLargeError(`object is ${body.length} bytes`);
      return body;
    },
    async put(key, body, contentType) {
      const res = await client.fetch(url(key), {
        method: 'PUT',
        body: new Uint8Array(body),
        headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
      });
      if (!res.ok) throw new Error(`storage: PUT failed with ${res.status}`);
    },
    async delete(key) {
      const res = await client.fetch(url(key), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`storage: DELETE failed with ${res.status}`);
    },
  };
}

/** In-memory storage for tests and for development without R2 */
export function memoryStorage(): ObjectStorage & { objects: Map<string, { body: Buffer; contentType: string }> } {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    objects,
    async presignPut(key, { contentType }) {
      return { url: `memory://${key}`, headers: { 'Content-Type': contentType } };
    },
    async get(key, maxBytes) {
      const o = objects.get(key);
      if (!o) return null;
      if (o.body.length > maxBytes) throw new ObjectTooLargeError(`object is ${o.body.length} bytes`);
      return o.body;
    },
    async put(key, body, contentType) {
      objects.set(key, { body, contentType });
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
