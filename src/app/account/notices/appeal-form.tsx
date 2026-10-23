'use client';

import { useActionState, useState } from 'react';
import { Alert, Button } from '../../../components/ui';
import { fieldDir } from '../../../lib/field-dir';
import { messages } from '../../../messages/fa';
import { appealAction, type AppealState } from './actions';

export function AppealForm({ decisionId }: { decisionId: string }) {
  const [state, action, pending] = useActionState<AppealState, FormData>(appealAction, undefined);
  const [body, setBody] = useState('');
  const t = messages.notices;
  return (
    <details className="mt-3 rounded-xl border border-neutral-200 p-3">
      <summary className="cursor-pointer text-sm font-bold text-brand-800">{t.appeal}</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="decisionId" value={decisionId} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.appealLabel}</span>
          <textarea
            name="body"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            dir={fieldDir(body)}
            className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
          <span className="mt-1 block text-xs text-neutral-500">{t.appealHint}</span>
        </label>
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <Button type="submit" disabled={pending}>{t.appealSend}</Button>
      </form>
    </details>
  );
}
