import Link from 'next/link';
import { cookies } from 'next/headers';
import { Flag } from '../../../components/flag';
import { Icon } from '../../../components/icons';
import { Alert, Button, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { formatDateTime } from '../../../lib/format';
import { webEnv } from '../../../lib/env';
import { admin } from '../../../messages/fa';
import { adminHref, requireStaff, staffCan } from '../../../modules/admin/server';
import { testAccountsAdmin } from '../../../modules/admin/users';
import { readViewAsUntil, VIEW_AS_COOKIE, VIEW_AS_HOURS } from '../../../modules/admin/view-as';
import { checkVerifiedNumber } from '../../../modules/users/phone-number';
import { countries } from '../../../../seed/countries';
import { endViewAsAction } from '../../view-as-actions';
import { actAsAction, viewAsAction } from '../admin-actions';
import { AdminTitle } from '../ui';

// «دیدن سایت از نگاه دیگران» (wave 2 part 1, mockup final/admin-viewas): view as a country (step
// 1c), signing in as a user (step 1d, admins only) and the test accounts (step 1a).

/** The launch plan's countries (scripts/test-accounts.ts), then Iran */
const PLAN = ['DE', 'AT', 'NL', 'GB', 'CA', 'US', 'AU', 'IT', 'SE', 'FR', 'TR'];

export default async function ViewAsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('overview.view');
  const sp = await searchParams;
  const mayAct = await staffCan('user.act_as');
  const actingError = sp.acting ? admin.viewAs.actingErrors[sp.acting] : undefined;
  const t = admin.viewAs;
  const env = webEnv();
  const name = (code: string) => (code === 'IR' ? t.iran : (countries.find((c) => c.code === code)?.nameFa ?? code));
  const current = readViewAsUntil((await cookies()).get(VIEW_AS_COOKIE)?.value, env.AUTH_SECRET);
  const accounts = await testAccountsAdmin(appDb(), { withContact: await staffCan('user.contact') });
  const field = 'h-11 rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-brand-600';
  const chip = 'flex h-10 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-sm hover:border-brand-600';

  return (
    <>
      <AdminTitle title={t.title} />
      {actingError && <div className="mb-4"><Alert tone="error">{actingError}</Alert></div>}
      <div className={`grid gap-4 ${mayAct ? 'lg:grid-cols-2' : ''}`}>
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Icon name="globe" className="size-5 text-brand-700" />
          {t.country}
        </h2>
        <p className="mt-1 text-sm leading-7 text-neutral-700">{t.countryIntro}</p>
        {current && (
          <form action={endViewAsAction} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-saffron-50 p-3 text-sm text-saffron-800">
            <span className="flex-1">{t.now(name(current.country), formatDateTime(current.until, env.APP_TIME_ZONE))}</span>
            <Link href="/" prefetch={false} className="font-bold underline">{t.open}</Link>
            <button type="submit" className="flex h-9 items-center rounded-lg bg-ink px-3 text-xs font-bold text-snow">{t.end}</button>
          </form>
        )}
        <form action={viewAsAction} className="mt-3 flex flex-wrap gap-2">
          {PLAN.map((code) => (
            <button key={code} type="submit" name="country" value={code} className={chip}>
              <Flag code={code} />
              {name(code)}
            </button>
          ))}
          <button type="submit" name="country" value="IR" className={chip}>
            <Icon name="globe" className="size-4" />
            {t.iran}
          </button>
        </form>
        <p className="mt-3 text-xs leading-6 text-neutral-500">{t.countryHint(VIEW_AS_HOURS)}</p>
      </section>
      {mayAct && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="flex items-center gap-2 font-extrabold">
            <Icon name="shield" className="size-5 text-saffron-700" />
            {t.acting}
          </h2>
          <p className="mt-1 text-sm leading-7 text-neutral-700">{t.actingIntro}</p>
          <form action={actAsAction} className="mt-3 grid gap-2">
            <input name="target" required maxLength={254} defaultValue={sp.target ?? ''} placeholder={t.target} aria-label={t.target} dir="auto" className={field} />
            <input name="reason" required minLength={5} maxLength={500} placeholder={t.reason} aria-label={t.reason} className={field} />
            <div className="flex gap-2">
              <input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} placeholder={t.code} aria-label={t.code} dir="ltr" className={`${field} min-w-0 flex-1`} />
              <Button type="submit">{t.continue}</Button>
            </div>
          </form>
        </section>
      )}
      </div>

      <section className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <div className="p-4">
          <h2 className="flex items-center gap-2 font-extrabold">
            <Icon name="user" className="size-5 text-brand-700" />
            {t.accounts}
          </h2>
          <p className="mt-1 text-sm text-neutral-700">{t.accountsIntro}</p>
          {env.TEST_ACCOUNT_CODE && <p className="mt-1 text-sm text-neutral-700">{t.accountsStaging}</p>}
        </div>
        {accounts.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-neutral-500">{t.noAccounts}</p>
        ) : (
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-600">
              <tr>
                <th className="p-3 text-start">{t.columns.country}</th>
                <th className="p-3 text-start">{t.columns.account}</th>
                <th className="p-3 text-start">{t.columns.city}</th>
                <th className="p-3 text-start">{t.columns.kind}</th>
                {mayAct && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const code = a.country ?? (a.phone ? checkVerifiedNumber(a.phone).country : null);
                return (
                  <tr key={a.id} className="border-t border-neutral-200">
                    <td className="p-3">
                      {code ? (
                        <span className="flex items-center gap-2">
                          <Flag code={code} />
                          {name(code)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3">
                      <Link href={adminHref(`/users/${a.id}`)} prefetch={false} className="hover:underline">
                        {a.email ? <bdi dir="ltr">{a.email}</bdi> : <bdi dir="auto">{a.name}</bdi>}
                      </Link>
                    </td>
                    <td className="p-3">{a.city ?? '—'}</td>
                    <td className="p-3">
                      <Pill tone={a.kind === 'country' ? 'neutral' : 'saffron'}>{t.kinds[a.kind]}</Pill>
                    </td>
                    {mayAct && (
                      <td className="p-3">
                        <form action={actAsAction}>
                          <input type="hidden" name="userId" value={a.id} />
                          <button type="submit" className="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-xs font-bold whitespace-nowrap hover:bg-neutral-50">{t.signInAs}</button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
