'use client';

import { useEffect } from 'react';
import { admin } from '../../messages/fa';
import { Button } from '../../components/ui';
import { reportBrowserError } from '../../lib/monitoring/browser';

// Also shown when a staff member goes over the page or action limit (AdminRateLimited). Server
// errors (with a digest) were reported on the server; only browser errors are reported here.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportBrowserError(error, 'react.error-boundary'), [error]);
  return (
    <div className="max-w-md">
      <h1 className="mb-3 text-xl font-extrabold">{admin.error.title}</h1>
      <p className="mb-4 text-sm text-neutral-700">{admin.error.body}</p>
      <Button type="button" variant="secondary" onClick={reset}>
        {admin.error.retry}
      </Button>
    </div>
  );
}
