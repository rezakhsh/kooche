import Link from 'next/link';
import type { ReactNode } from 'react';
import { pages } from '../messages/fa';
import { legalDe } from '../messages/legal-de';
import { type LegalBlock, type LegalDoc, sectionAnchor } from '../messages/legal-types';
import { operator } from '../messages/operator';
import { LegalNav } from './legal-nav';

// The terms of use and the privacy policy, in Persian (right to left) or the binding German
// version (left to right inside the RTL page). Plain HTML: anchors per section, no JavaScript.

type Lang = 'fa' | 'de';

/** Name, address and email of the operator (src/messages/operator.ts); German data, labels per language */
export function OperatorBlock({ lang }: { lang: Lang }) {
  const t = pages.legal.operator;
  const de = lang === 'de';
  const rows: [string, ReactNode][] = [
    [de ? 'Name' : t.name, operator.name],
    [de ? 'Anschrift' : t.address, <span key="a" dir="ltr">{`${operator.street}, ${operator.postalCode} ${operator.city}, ${de ? operator.countryDe : operator.countryFa}`}</span>],
    [de ? 'E-Mail' : t.email, <a key="e" href={`mailto:${operator.email}`} dir="ltr" className="text-brand-800 underline">{operator.email}</a>],
  ];
  if (operator.phone) rows.push([de ? 'Telefon' : t.phone, <span key="p" dir="ltr">{operator.phone}</span>]);
  if (operator.vatId) rows.push([de ? 'USt-IdNr.' : t.vatId, <span key="v" dir="ltr">{operator.vatId}</span>]);
  if (operator.register) rows.push([de ? 'Registereintrag' : t.register, <span key="r" dir="ltr">{operator.register}</span>]);
  return (
    <dl className="my-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-neutral-50 p-4 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold text-neutral-700">{label}</dt>
          <dd className="text-neutral-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ block, lang }: { block: LegalBlock; lang: Lang }) {
  if (typeof block === 'string') return <p className="my-3 leading-7 text-neutral-700">{block}</p>;
  if ('list' in block) {
    return (
      <ul className="my-3 list-disc space-y-1.5 ps-6 leading-7 text-neutral-700">
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return <OperatorBlock lang={lang} />;
}

export function DraftBanner({ text }: { text: string }) {
  return <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{text}</p>;
}

/**
 * A whole legal page. `other` links to the other language's version; `nav` (Persian pages only)
 * shows the row of legal pages above it. The German version sets lang and dir itself, so screen
 * readers and the browser treat it as German, left to right.
 */
export function LegalDocPage({ doc, lang, other, nav }: { doc: LegalDoc; lang: Lang; other: string; nav?: 'terms' | 'privacy' }) {
  const de = lang === 'de';
  const labels = de
    ? { draft: legalDe.draft, other: legalDe.persianVersion, note: legalDe.binding, contents: legalDe.contents }
    : { draft: pages.legal.draft, other: pages.legal.germanVersion, note: pages.legal.germanBinding, contents: pages.legal.contents };
  const main = doc.sections.filter((s) => !s.id.includes('.'));
  return (
    <main lang={lang} dir={de ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      {nav && <LegalNav current={nav} />}
      <h1 className="mb-2 text-2xl font-extrabold">{doc.title}</h1>
      <p className="mb-4 text-sm text-neutral-500">{doc.updated}</p>
      {doc.draft && <DraftBanner text={labels.draft} />}
      <p className="mb-4 text-sm text-neutral-600">
        {labels.note}{' '}
        <Link href={other} hrefLang={de ? 'fa' : 'de'} className="font-semibold text-brand-800 underline">
          {labels.other}
        </Link>
      </p>
      {doc.intro.map((p) => (
        <p key={p} className="my-3 leading-7 text-neutral-700">
          {p}
        </p>
      ))}
      <nav aria-label={labels.contents} className="my-6 rounded-xl border border-neutral-200 p-4">
        <h2 className="mb-2 text-sm font-bold text-neutral-900">{labels.contents}</h2>
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {main.map((s) => (
            <li key={s.id}>
              <a href={`#${sectionAnchor(s.id)}`} className="text-brand-800 hover:underline">
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {doc.sections.map((s) => {
        const Heading = s.id.includes('.') ? 'h3' : 'h2';
        return (
          <section key={s.id} id={sectionAnchor(s.id)} className="scroll-mt-20">
            <Heading className={Heading === 'h2' ? 'mt-10 text-xl font-extrabold' : 'mt-6 font-bold'}>{s.heading}</Heading>
            {s.body.map((b, i) => (
              <Block key={i} block={b} lang={lang} />
            ))}
          </section>
        );
      })}
    </main>
  );
}
