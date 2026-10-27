import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppBar } from '../../../../components/app-bar';
import { Icon, type IconName } from '../../../../components/icons';
import { appDb } from '../../../../db/drizzle';
import { messages } from '../../../../messages/fa';
import { cityFoundingPlaces } from '../../../../modules/payments/founding';
import { browsePath } from '../../../../modules/search/paths';
import { resolveBrowse } from '../../_browse/resolve';

// What a founding business gets in a city (round 12, mockup final/founding-business), linked from
// the city's waitlist page: said plainly, with the real places left, then how it works, and
// «ثبت رایگان کسب‌وکار» always at hand. Only normal features: nothing here is promised that the
// product doesn't do.

type Props = { params: Promise<{ country: string; place: string }> };

const PERK_ICONS: IconName[] = ['store', 'star', 'home', 'sparkle', 'calendar', 'verified', 'chat'];
const fa = (n: number) => n.toLocaleString('fa-IR');

async function load(params: Props['params']) {
  const b = await resolveBrowse(params, Promise.resolve({}));
  if (!b.city || b.category) notFound();
  return { b, city: b.city, places: await cityFoundingPlaces(appDb(), b.city.id) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await load(params);
  return { title: messages.founding.title(city.nameFa) };
}

export default async function FoundingPage({ params }: Props) {
  const { b, city, places } = await load(params);
  const t = messages.founding;
  const left = Math.max(0, places.places - places.used);
  const pct = places.places ? Math.min(100, (places.used / places.places) * 100) : 0;
  return (
    <>
      <AppBar title={t.title(city.nameFa)} back={browsePath(b.country.slug, city.slug, null)} backLabel={messages.account.back} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-28 lg:pb-10">
        <section className="rounded-3xl bg-gradient-to-b from-brand-50 to-white p-4 lg:p-6">
          <p className="flex items-center gap-2 text-xs font-bold text-brand-800">
            <Icon name="store" className="size-4" />
            {t.eyebrow(city.nameFa)}
          </p>
          <h1 className="mt-1 text-2xl font-black leading-[1.5]">{t.heading(city.nameFa)}</h1>
          <p className="mt-1 text-[15px] leading-8 text-neutral-700">{t.intro}</p>
          <p className="mt-3 flex items-baseline justify-between gap-3 text-sm">
            <b>{t.filled(places.used, places.places)}</b>
            <span className="text-neutral-600">{t.left(left)}</span>
          </p>
          <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-2 block h-2.5 w-full overflow-hidden rounded-full ring-1 ring-brand-100" role="progressbar" aria-valuemin={0} aria-valuemax={places.places} aria-valuenow={places.used}>
            <rect width="100" height="4" className="fill-white" />
            <rect x={100 - pct} width={pct} height="4" className="fill-brand-600" />
          </svg>
        </section>

        <h2 className="mt-6 text-lg font-extrabold">{t.whatTitle}</h2>
        <ul className="mt-3 space-y-2">
          {t.perks(city.nameFa, places.places).map((p, i) => (
            <li key={p.title} className="flex items-start gap-3 rounded-2xl border border-neutral-200 p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={PERK_ICONS[i]!} className="size-5" />
              </span>
              <span>
                <b className="block text-sm">{p.title}</b>
                <span className="text-xs leading-6 text-neutral-600">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mt-7 text-lg font-extrabold">{t.howTitle}</h2>
        <ol className="mt-3 space-y-3">
          {t.steps(city.nameFa).map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{fa(i + 1)}</span>
              <span>
                <b className="block text-sm">{s.title}</b>
                <span className="text-xs text-neutral-600">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-xs leading-6 text-neutral-600">
          {t.after}{' '}
          <Link href="/pro" className="font-bold text-brand-800 underline">
            {t.compare}
          </Link>
        </p>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:pt-0">
        <div className="mx-auto max-w-3xl">
          <Link href="/business/new" className="flex h-12 items-center justify-center rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800">
            {t.cta}
          </Link>
        </div>
      </div>
    </>
  );
}
