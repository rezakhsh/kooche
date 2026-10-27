import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { Alert, Button, Field } from '../../../components/ui';
import { TaskPage } from '../../../components/settings';
import { messages } from '../../../messages/fa';
import { requireSession } from '../../../modules/users/server';
import { deleteAccountAction } from './actions';

export const metadata = { title: messages.account.delete.title, robots: { index: false } };

// Deleting the account (approved Oct 21, 2026): what happens, following the retention rules
// (docs/schema.md, section 14), then a confirmation with the account's own email address.

const ERRORS = new Set(['email_mismatch', 'not_confirmed', 'sole_owner'] as const);
type ErrorCode = typeof ERRORS extends Set<infer T> ? T : never;

export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireSession('/account/delete');
  const { error } = await searchParams;
  const t = messages.account.delete;
  const code = ERRORS.has(error as ErrorCode) ? (error as ErrorCode) : null;
  return (
    <TaskPage title={t.title} back="/account/settings" backLabel={messages.account.back}>
      <div className="space-y-6">
        {code && <Alert tone="error">{t.errors[code]}</Alert>}
        <section className="space-y-3">
          <h2 className="font-bold">{t.whatHappens}</h2>
          <ul className="list-disc space-y-2 ps-5 text-sm leading-relaxed text-neutral-700">
            {t.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="text-sm">
            <Link href="/account/data" className="font-bold text-brand-800 underline">
              {t.exportFirst}
            </Link>
          </p>
        </section>
        <form action={deleteAccountAction} className="space-y-4 rounded-2xl border border-red-200 bg-red-50/40 p-5">
          <Field label={t.emailLabel} hint={t.emailHint} name="email" type="email" required autoComplete="off" dir="ltr" />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="confirm" required className="mt-0.5 size-5" />
            <span>{t.confirm}</span>
          </label>
          <Button type="submit" variant="danger" className="w-full">
            <Icon name="trash" className="size-4" />
            {t.button}
          </Button>
        </form>
      </div>
    </TaskPage>
  );
}
