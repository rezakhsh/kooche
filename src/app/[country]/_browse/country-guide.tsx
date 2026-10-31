import Link from 'next/link';
import { Flag } from '../../../components/flag';
import { Icon, type IconName } from '../../../components/icons';
import { messages } from '../../../messages/fa';
import type { CountryInfo } from '../../../modules/launch/country-page';
import type { Country } from '../../../modules/listings/queries';
import { eventsPath } from '../../../modules/search/paths';
import { turnstileSiteKey } from '../../../modules/security/server';
import { RememberCountry } from '../remember-country';
import { WaitlistForm } from './waitlist-form';

// A country in guide mode (Turkey; mockup final/turkey, built at the owner's request in the design
// check, Oct 31, 2026): no marketplace, an account-free guide instead. Named scam warnings, the
// official places, what already works from there (online events and services of the open
// countries), and «خبرم کن» on its first city's waitlist with no promised date. The texts are per
// country in the messages file (countryPage.guidePage.<code>).

const t = messages.countryPage.guidePage;

export function CountryGuide({
  country,
  detected,
  waiting,
  elsewhere,
}: {
  country: CountryInfo;
  detected: boolean;
  waiting: Array<{ id: string; nameFa: string }>;
  elsewhere: Country | null;
}) {
  const g = t[country.code as keyof typeof t];
  const text = typeof g === 'object' && 'intro' in g ? g : null;
  const works: Array<[IconName, string, string, string]> = elsewhere
    ? [
        ['calendar', t.onlineEvents, t.onlineEventsSub, `${eventsPath(elsewhere.slug, null)}?attendance=online`],
        ['wrench', t.onlineServices, t.onlineServicesSub, `/${elsewhere.slug}/online`],
      ]
    : [];
  return (
    <main className="pb-24">
      {!detected && <RememberCountry slug={country.slug} />}
      <section className="bg-gradient-to-b from-brand-50 to-white px-4 pt-7 pb-4 lg:pt-14">
        <div className="mx-auto max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-800">
            <Flag code={country.code} className="h-4 w-6" />
            {detected ? messages.home.seemsIn(country.nameFa) : country.nameFa}
          </p>
          <h1 className="mt-3 text-[26px] font-black leading-[1.5] text-balance lg:text-4xl">{t.title(country.nameFa)}</h1>
          {text && <p className="mt-2 text-base leading-8 text-neutral-700">{text.intro}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6">
        <div>
          {text && (
            <>
              <div className="rounded-2xl bg-saffron-50 p-4">
                <h2 className="flex items-center gap-2 text-base font-extrabold text-saffron-800">
                  <Icon name="alert" className="size-5" />
                  {t.scamsTitle}
                </h2>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-7 text-neutral-800">
                  {text.scams.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-6 text-saffron-800">{text.scamsNote}</p>
              </div>
              <h2 className="mt-6 text-lg font-extrabold">{t.officialTitle}</h2>
              <ul className="mt-3 space-y-2">
                {text.official.map((o) => (
                  <li key={o.url}>
                    <a href={o.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5 hover:border-brand-300">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon name="shield" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-sm">
                          <bdi>{o.name}</bdi>
                        </b>
                        <span className="text-xs leading-6 text-neutral-600">{o.sub}</span>
                      </span>
                      <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          {works.length > 0 && (
            <>
              <h2 className="mt-6 text-lg font-extrabold lg:mt-0">{t.worksTitle(country.nameFa)}</h2>
              <ul className="mt-3 space-y-2">
                {works.map(([icon, title, sub, href]) => (
                  <li key={href}>
                    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3.5 hover:border-brand-300">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon name={icon} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-sm">{title}</b>
                        <span className="text-xs leading-6 text-neutral-600">{sub}</span>
                      </span>
                      <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {waiting.length > 0 && (
            <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-base font-extrabold">{t.formTitle(country.nameFa)}</h2>
              <p className="mt-1 mb-3 text-sm leading-7 text-neutral-700">{t.formText}</p>
              <WaitlistForm cities={waiting} turnstileSiteKey={turnstileSiteKey()} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
