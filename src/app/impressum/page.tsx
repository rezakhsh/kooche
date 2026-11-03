import type { Metadata } from 'next';
import Link from 'next/link';
import { OperatorBlock } from '../../components/legal-doc';
import { LegalNav } from '../../components/legal-nav';
import { PageShell } from '../../components/ui';
import { pages } from '../../messages/fa';
import { operator } from '../../messages/operator';

// §5 DDG. The details themselves are German (name, address), so the legal block is German, left to
// right, with a Persian explanation around it. Operator details: src/messages/operator.ts.

export const metadata: Metadata = { title: pages.impressum.title, alternates: { canonical: '/impressum' } };

export default function ImpressumPage() {
  const t = pages.impressum;
  return (
    <PageShell title={t.title} wide>
      <LegalNav current="impressum" />
      <p className="mb-6 leading-7 text-neutral-700">{t.intro}</p>
      <section lang="de" dir="ltr" className="rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-xl font-extrabold">{t.heading}</h2>
        <p className="mt-1 text-sm text-neutral-500">{t.law}</p>
        <OperatorBlock lang="de" />
        <h3 className="mt-5 font-bold">{t.formLabel}</h3>
        <p className="mt-1 leading-7 text-neutral-700">
          {t.form}{' '}
          <Link href="/contact#form" className="text-brand-800 underline">
            {t.formLink}
          </Link>
        </p>
        <h3 className="mt-5 font-bold">{t.postLabel}</h3>
        <p className="mt-1 leading-7 text-neutral-700">{t.post}</p>
        <h3 className="mt-5 font-bold">{t.dsaLabel}</h3>
        <p className="mt-1 leading-7 text-neutral-700">{t.dsa}</p>
        <p className="mt-1 leading-7 text-neutral-700">
          {t.dsaAuthorities}{' '}
          <a href={`mailto:${operator.authoritiesEmail}`} className="text-brand-800 underline">
            {operator.authoritiesEmail}
          </a>
          . {t.dsaAuthoritiesNote}
        </p>
        <h3 className="mt-5 font-bold">{t.disputeLabel}</h3>
        <p className="mt-1 leading-7 text-neutral-700">{t.dispute}</p>
      </section>
      <div className="mt-6 space-y-3 leading-7 text-neutral-700">
        <p>
          {t.formFa}{' '}
          <Link href="/contact#form" className="font-semibold text-brand-800 underline">
            {t.formFaLink}
          </Link>
        </p>
        <p>{t.postFa}</p>
        <p>{t.dsaFa}</p>
        <p>
          {t.dsaAuthoritiesFa}{' '}
          <a href={`mailto:${operator.authoritiesEmail}`} dir="ltr" className="font-semibold text-brand-800 underline">
            {operator.authoritiesEmail}
          </a>
          . {t.dsaAuthoritiesNoteFa}
        </p>
        <p>{t.disputeFa}</p>
        <p>
          <Link href="/contact" className="font-semibold text-brand-800 underline">
            {t.more}
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
