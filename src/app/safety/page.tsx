import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '../../components/ui';
import { messages, pages } from '../../messages/fa';

// Safety tips. The warnings shown under risky chat messages are quoted from messages.chat.risk, so
// the page and the chat always say the same thing.

export const metadata: Metadata = { title: pages.safety.title, description: pages.safety.intro, alternates: { canonical: '/safety' } };

export default function SafetyPage() {
  const t = pages.safety;
  const risk = messages.chat.risk;
  return (
    <PageShell title={t.title} wide>
      <p className="leading-7 text-neutral-700">{t.intro}</p>
      <p className="mt-4 rounded-xl bg-saffron-50 px-4 py-3 font-semibold leading-7 text-neutral-900">{messages.chat.tip}</p>
      {t.sections.map((s) => (
        <section key={s.heading}>
          <h2 className="mt-8 text-lg font-extrabold">{s.heading}</h2>
          <ul className="mt-2 list-disc space-y-1.5 ps-6 leading-7 text-neutral-700">
            {s.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ))}
      <section className="mt-8 rounded-2xl border border-neutral-200 p-5">
        <h2 className="font-extrabold">{t.chatWarnings}</h2>
        <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
          {[risk.payment_request, risk.link, risk.iban, risk.off_platform_contact, risk.phone_number].map((w) => (
            <li key={w}>
              <span className="font-bold text-amber-800">{risk.title}: </span>
              {w}
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-8">
        <Link href="/contact" className="font-semibold text-brand-800 underline">
          {t.contact}
        </Link>
      </p>
    </PageShell>
  );
}
