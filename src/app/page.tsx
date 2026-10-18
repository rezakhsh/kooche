import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Flag } from '../components/flag';
import { Icon, type IconName } from '../components/icons';
import { appDb } from '../db/drizzle';
import { visitorCountry } from '../lib/client-ip';
import { messages } from '../messages/fa';
import { activeCountries, countryCounts } from '../modules/listings/queries';
import { chosenCountry } from './country-choice';

// The home page lists the open countries (decided Oct 17, 2026, like Divar's list of cities).
// A visitor who chose one before goes straight to it; `?choose` shows the list again. Search
// engines carry no cookie, so they always see the list with links to every country.

const WHY_ICONS: IconName[] = ['search', 'shield', 'plus'];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ choose?: string }> }) {
  const db = appDb();
  const { choose } = await searchParams;
  if (choose === undefined) {
    const chosen = await chosenCountry(db);
    if (chosen) redirect(`/${chosen.slug}`);
  }
  const [countries, counts] = await Promise.all([activeCountries(db), countryCounts(db)]);
  const here = visitorCountry(await headers());
  // The visitor's own country first
  const ordered = [...countries].sort((a, b) => Number(b.code === here) - Number(a.code === here));
  const t = messages.home;

  return (
    <main>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-3xl px-4 pt-10 pb-8 sm:px-6 sm:pt-16">
          <h1 className="text-3xl font-black leading-tight text-balance sm:text-5xl sm:leading-tight">{t.title}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-700 sm:text-lg">{t.intro}</p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 pb-6 sm:px-6">
        <h2 className="mb-4 text-lg font-extrabold">{t.chooseCountry}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ordered.map((c) => {
            const mine = c.code === here;
            return (
              <li key={c.code}>
                <Link
                  href={`/${c.slug}`}
                  className={`flex items-center gap-4 rounded-2xl border bg-white px-4 py-4 transition-shadow hover:shadow-md ${
                    mine ? 'border-brand-700 ring-4 ring-brand-50' : 'border-neutral-200'
                  }`}
                >
                  <Flag code={c.code} className="h-6 w-9" />
                  <span className="flex flex-col">
                    <span className="text-lg font-extrabold leading-tight">{c.nameFa}</span>
                    <bdi dir="ltr" className="text-xs text-neutral-500">
                      {c.nameLocal}
                    </bdi>
                  </span>
                  <span className="ms-auto flex flex-col items-end gap-1 text-xs text-neutral-500">
                    {mine && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-bold text-brand-700">{t.yourCountry}</span>}
                    {t.listingCount(counts.get(c.code) ?? 0)}
                  </span>
                  <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                </Link>
              </li>
            );
          })}
        </ul>
        <ul className="mt-10 grid gap-5 sm:grid-cols-3">
          {t.why.map((w, i) => (
            <li key={w.title} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={WHY_ICONS[i]!} />
              </span>
              <span className="text-sm text-neutral-600">
                <span className="block font-bold text-neutral-900">{w.title}</span>
                {w.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
