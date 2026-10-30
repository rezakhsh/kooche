import type { Metadata } from 'next';
import Link from 'next/link';
import { AppBar } from '../../../components/app-bar';
import { Icon } from '../../../components/icons';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { messages } from '../../../messages/fa';
import { proMonthlyText } from '../../../modules/payments/prices';

// Private or business, in one page (wave 2 part 4, mockup final/private-vs-business). The big
// difference is being found: a business has a page, a place among the city's verified businesses
// and in Google. Only what Peydoo offers today is listed (no menu, WhatsApp or video yet); the
// numbers are the plans' (seed/products.ts) and the private limits (src/modules/organizations/limits.ts).

const t = messages.business.compare;

export function generateMetadata(): Metadata {
  return { title: `${t.title} | ${messages.site.name}`, description: t.intro, alternates: { canonical: `${webEnv().APP_URL}/business/compare` } };
}

export default async function ComparePage() {
  const pro = await proMonthlyText(appDb());
  return (
    <>
      <AppBar title={t.title} back="/" backLabel={messages.notFound.home} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
        <h1 className="text-2xl font-black leading-[1.5] text-balance">{t.heading}</h1>
        <p className="mt-1 text-[15px] leading-8 text-neutral-700">{t.intro}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-neutral-200 p-3">
            <p className="flex items-center gap-1.5 text-sm font-extrabold">
              <Icon name="user" className="size-4 text-neutral-600" />
              {t.person}
            </p>
            <div className="mt-2 rounded-xl bg-neutral-50 p-2">
              <span className="flex h-16 items-center justify-center rounded-lg bg-neutral-200 text-neutral-500">
                <Icon name="image" className="size-6" />
              </span>
              <span className="mt-2 block text-xs font-bold">{t.sample.privateTitle}</span>
              <span className="text-xs text-neutral-600">{t.sample.privateLine}</span>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-brand-300 bg-brand-50 p-3">
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-brand-800">
              <Icon name="store" className="size-4" />
              {t.business}
            </p>
            <div className="mt-2 rounded-xl bg-white p-2">
              <span className="flex items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-black text-brand-800">{t.sample.tile}</span>
                <span className="min-w-0 text-xs">
                  <b className="block truncate">{t.sample.businessName}</b>
                  <span className="flex items-center gap-0.5 text-brand-800">
                    <Icon name="verified" className="size-3" />
                    {messages.countryPage.starter.verified}
                  </span>
                </span>
              </span>
              <span className="mt-2 flex gap-1">
                {(['send', 'phone', 'globe'] as const).map((i) => (
                  <span key={i} className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon name={i} className="size-3.5" />
                  </span>
                ))}
              </span>
              <span className="mt-1 block text-xs text-neutral-600">{t.sample.businessLine}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-600">
              <tr>
                <th className="p-2.5 text-start font-bold" />
                <th className="p-2.5 text-start font-bold">{t.person}</th>
                <th className="p-2.5 text-start font-bold text-brand-800">{t.business}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {t.rows(pro).map(([label, person, business], i) => (
                <tr key={label} className={i === 1 ? 'bg-brand-50' : ''}>
                  <th scope="row" className="p-2.5 text-start align-top text-xs font-bold text-neutral-700">
                    {label}
                  </th>
                  <td className="p-2.5 align-top text-xs leading-6 text-neutral-700">{person}</td>
                  <td className={`p-2.5 align-top text-xs leading-6 ${i === 1 ? 'font-bold' : ''}`}>{business}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 rounded-2xl bg-saffron-50 p-4 text-sm leading-7">
          <b className="text-saffron-800">{t.which}</b> {t.whichText}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href="/new" className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 font-bold hover:bg-neutral-50">
            {t.privateCta}
          </Link>
          <Link href="/business/new" className="flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800">
            {t.businessCta}
          </Link>
        </div>
      </main>
    </>
  );
}
