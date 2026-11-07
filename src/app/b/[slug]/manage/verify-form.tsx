'use client';

import { useState } from 'react';
import { Icon } from '../../../../components/icons';
import { isStalePage } from '../../../../lib/stale-page';
import { messages } from '../../../../messages/fa';
import { MAX_DOC_BYTES } from '../../../../modules/media/limits';
import { createShrinker } from '../../../../modules/media/shrink-client';
import { documentUploadAction, submitVerificationAction } from '../../../business/actions';

// «درخواست تأیید» on the business's manage page (wave 2 part 4, src/modules/organizations/verification.ts):
// one document (PDF, JPEG or PNG, up to 10 MB) uploaded straight to storage, then sent with the form.

const t = messages.business.verification;

export function VerifyForm({ organizationId, slug }: { organizationId: string; slug: string }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'uploading' | 'ready' | 'failed' | 'stale'>('idle');
  async function pick(original: File | undefined) {
    if (!original) return;
    setState('uploading');
    setName(original.name);
    // A photo of the document over 10 MB becomes a smaller JPEG first (a PDF or PNG goes as it is)
    const shrinker = createShrinker({ jpegOnly: true, maxBytes: MAX_DOC_BYTES });
    try {
      const file = original.type === 'image/jpeg' ? await shrinker.shrink(original) : original;
      const ticket = await documentUploadAction(file.type, file.size);
      if (!ticket.ok) throw new Error('refused');
      const res = await fetch(ticket.url, { method: 'PUT', body: file, headers: ticket.headers });
      if (!res.ok) throw new Error('upload');
      setKey(ticket.key);
      setState('ready');
    } catch (e) {
      setKey('');
      setState(isStalePage(e) ? 'stale' : 'failed');
    } finally {
      shrinker.close();
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
          <span className={`text-xs ${state === 'failed' || state === 'stale' ? 'text-red-700' : 'text-neutral-600'}`}>
            {state === 'uploading' ? t.uploading : state === 'ready' ? t.ready : state === 'failed' ? t.failed : state === 'stale' ? messages.stalePage.text : t.hint}
          </span>
        </span>
        <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      {state === 'stale' && (
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-bold text-brand-800 underline">
          {messages.stalePage.reload}
        </button>
      )}
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
