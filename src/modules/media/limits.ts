// Photo upload limits, shared by the server (which signs them into the upload URL) and the
// photo editor in the browser (which checks them before uploading). No server imports here.

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
