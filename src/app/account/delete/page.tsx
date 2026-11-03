import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { Alert, Button, Field } from '../../../components/ui';
import { TaskPage } from '../../../components/settings';
import { messages } from '../../../messages/fa';
import { requireSession } from '../../../modules/users/server';
import { appDb } from '../../../db/drizzle';
import { soleOwned } from '../../../modules/users/erasure';
import { deleteAccountAction } from './actions';

export const metadata = { title: messages.account.delete.title, robots: { index: false } };

// Deleting the account (approved Oct 21, 2026): what happens, following the retention rules
// (docs/schema.md, section 14), then a confirmation with the account's own email address.

const ERRORS = new Set(['email_mismatch', 'not_confirmed', 'plan_running', 'acting', 'staff'] as const);
type ErrorCode = typeof ERRORS extends Set<infer T> ? T : never;

export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await requireSession('/account/delete');
  const closing = await soleOwned(appDb(), user.id);
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
        {closing.length > 0 && (
          <section className="space-y-2 rounded-2xl border border-saffron-300 bg-saffron-50 p-4">
            <h2 className="font-bold">{t.businessesTitle}</h2>
            <p className="text-sm leading-7 text-neutral-700">{t.businessesBody}</p>
            <ul className="space-y-1.5 text-sm">
              {closing.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <b>{b.name}</b>
                  <Link href={`/b/${b.slug}/team`} className="font-bold text-brand-800 underline">{t.handOver}</Link>
                  {b.planRenews && (
                    <Link href={`/b/${b.slug}/billing`} className="font-bold text-red-700 underline">{t.planRenews}</Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
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
