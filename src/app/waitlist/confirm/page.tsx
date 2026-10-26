import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { Alert, Button, Card, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { countries, locations } from '../../../db/schema';
import { messages } from '../../../messages/fa';
import { browsePath } from '../../../modules/search/paths';
import { confirmWaitlistAction } from '../actions';

// The link in the waitlist confirmation email lands here; the button confirms (a mail scanner that
// opens the link confirms nothing).

export const metadata = { title: messages.launch.confirm.title, robots: { index: false } };

export default async function ConfirmWaitlistPage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string; invalid?: string }> }) {
  const sp = await searchParams;
  const t = messages.launch.confirm;
  let content;
  if (sp.done) {
    const [city] = await appDb()
      .select({ nameFa: locations.nameFa, slug: locations.slug, country: countries.slug })
      .from(locations)
      .innerJoin(countries, eq(countries.code, locations.countryCode))
      .where(and(eq(locations.slug, sp.done.slice(0, 60)), eq(locations.kind, 'city')));
    content = city ? (
      <>
        <Alert tone="success">{t.done(city.nameFa)}</Alert>
        <Link href={browsePath(city.country!, city.slug, null)} className="mt-4 inline-block font-bold text-brand-800 underline">
          {t.back(city.nameFa)}
        </Link>
      </>
    ) : (
      <Alert tone="error">{t.invalid}</Alert>
    );
  } else if (sp.invalid || !sp.t) {
    content = <Alert tone="error">{t.invalid}</Alert>;
  } else {
    content = (
      <form action={confirmWaitlistAction} className="space-y-4">
        <p className="leading-7 text-neutral-700">{t.intro}</p>
        <input type="hidden" name="t" value={sp.t.slice(0, 64)} />
        <Button type="submit" className="w-full">
          {t.button}
        </Button>
      </form>
    );
  }
  return (
    <PageShell title={t.title}>
      <Card>{content}</Card>
    </PageShell>
  );
}
