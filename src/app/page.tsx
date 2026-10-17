import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { appDb } from '../db/drizzle';
import { visitorCountry } from '../lib/client-ip';
import { messages } from '../messages/fa';
import { activeCountries } from '../modules/listings/queries';
import { chosenCountry } from './country-choice';

// The home page lists the open countries (decided Oct 17, 2026, like Divar's list of cities).
// A visitor who chose one before goes straight to it; `?choose` shows the list again. Search
// engines carry no cookie, so they always see the list with links to every country.

export default async function HomePage({ searchParams }: { searchParams: Promise<{ choose?: string }> }) {
  const db = appDb();
  const { choose } = await searchParams;
  if (choose === undefined) {
    const chosen = await chosenCountry(db);
    if (chosen) redirect(`/${chosen.slug}`);
  }
  const countries = await activeCountries(db);
  const here = visitorCountry(await headers());
  const t = messages.home;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{t.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-neutral-700">{t.intro}</p>
      <h2 className="mt-10 mb-4 font-semibold">{t.chooseCountry}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {countries.map((c) => (
          <li key={c.code}>
            <Link
              href={`/${c.slug}`}
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 hover:bg-neutral-50 ${
                c.code === here ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-neutral-200'
              }`}
            >
              <span className="text-lg font-semibold">{c.nameFa}</span>
              <span className="text-sm text-neutral-500">
                {c.code === here ? t.yourCountry : <bdi dir="ltr">{c.nameLocal}</bdi>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
