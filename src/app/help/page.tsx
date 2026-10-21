import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '../../components/ui';
import { pages } from '../../messages/fa';

// Help and FAQ. <details> opens without JavaScript, so the strict CSP needs nothing new.

export const metadata: Metadata = { title: pages.help.title, description: pages.help.intro, alternates: { canonical: '/help' } };

export default function HelpPage() {
  const t = pages.help;
  return (
    <PageShell title={t.title} wide>
      <p className="leading-7 text-neutral-700">{t.intro}</p>
      {t.groups.map((g) => (
        <section key={g.heading}>
          <h2 className="mt-8 mb-3 text-lg font-extrabold">{g.heading}</h2>
          <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
            {g.items.map((item) => (
              <details key={item.q} className="group px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-neutral-900 marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {item.q}
                    <span aria-hidden className="text-neutral-400 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 leading-7 text-neutral-700">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="mt-8 text-neutral-700">
        {t.more}{' '}
        <Link href="/contact" className="font-semibold text-brand-800 underline">
          {t.contact}
        </Link>
      </p>
    </PageShell>
  );
}
