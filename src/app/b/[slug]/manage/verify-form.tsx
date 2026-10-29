'use client';

import { useState } from 'react';
import { Icon } from '../../../../components/icons';
import { messages } from '../../../../messages/fa';
import { documentUploadAction, submitVerificationAction } from '../../../business/actions';

// «درخواست تأیید» on the business's manage page (wave 2 part 4, src/modules/organizations/verification.ts):
// one document (PDF, JPEG or PNG, up to 10 MB) uploaded straight to storage, then sent with the form.

const t = messages.business.verification;

export function VerifyForm({ organizationId, slug }: { organizationId: string; slug: string }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'uploading' | 'ready' | 'failed'>('idle');
  async function pick(file: File | undefined) {
    if (!file) return;
    setState('uploading');
    setName(file.name);
    try {
      const ticket = await documentUploadAction(file.type, file.size);
      if (!ticket.ok) throw new Error('refused');
      const res = await fetch(ticket.url, { method: 'PUT', body: file, headers: ticket.headers });
      if (!res.ok) throw new Error('upload');
      setKey(ticket.key);
      setState('ready');
    } catch {
      setKey('');
      setState('failed');
    }
  }
  return (
    <form action={submitVerificationAction} className="mt-3 space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="upload" value={key} />
      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-brand-600/40">
        <Icon name="doc" className="size-6 shrink-0 text-brand-700" />
        <span className="min-w-0 flex-1 text-sm">
          <b className="block truncate">{state === 'idle' ? t.pick : name}</b>
          <span className={`text-xs ${state === 'failed' ? 'text-red-700' : 'text-neutral-600'}`}>
            {state === 'uploading' ? t.uploading : state === 'ready' ? t.ready : state === 'failed' ? t.failed : t.hint}
          </span>
        </span>
        <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      <button
        type="submit"
        disabled={state !== 'ready'}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50 sm:w-auto"
      >
        {t.submit}
      </button>
    </form>
  );
}
