'use client';

import { admin } from '../../messages/fa';
import { Button } from '../../components/ui';

// Also shown when a staff member goes over the page or action limit (AdminRateLimited)
export default function AdminError({ reset }: { reset: () => void }) {
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
