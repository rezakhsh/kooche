import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '../../components/ui';
import { messages, pages } from '../../messages/fa';
import { operator } from '../../messages/operator';
import { turnstileSiteKey } from '../../modules/security/server';
import { currentSession } from '../../modules/users/server';
import { ContactForm } from './contact-form';

// Contact: the email address (DSA art. 11 and 12 point of contact, art. 16 notices) and the contact
// form, the second quick channel the Impressum needs (§ 5 DDG; src/modules/users/contact.ts).

export const metadata: Metadata = { title: pages.contact.title, description: pages.contact.intro, alternates: { canonical: '/contact' } };

export default async function ContactPage() {
  const t = pages.contact;
  const f = messages.contactForm;
  const session = await currentSession();
  return (
    <PageShell title={t.title} wide>
      <p className="leading-7 text-neutral-700">{t.intro}</p>
      <p className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <span className="block text-sm text-neutral-600">{t.emailLabel}</span>
        <a href={`mailto:${operator.email}`} dir="ltr" className="text-lg font-extrabold break-all text-brand-800 underline">
          {operator.email}
        </a>
      </p>
      <section id="form" className="mt-8 scroll-mt-20">
        <h2 className="text-lg font-extrabold">{f.heading}</h2>
        <p className="mt-2 mb-4 leading-7 text-neutral-700">{f.intro}</p>
        <ContactForm signedIn={!!session} name={session?.user.name ?? ''} email={session?.user.email ?? null} turnstileSiteKey={turnstileSiteKey()} />
      </section>
      {t.sections.map((s) => (
        <section key={s.heading} id={'id' in s ? s.id : undefined} className="scroll-mt-20">
          <h2 className="mt-8 text-lg font-extrabold">{s.heading}</h2>
          <p className="mt-2 leading-7 text-neutral-700">{s.text}</p>
          {'points' in s && (
            <ul className="mt-2 list-disc space-y-1.5 ps-6 leading-7 text-neutral-700">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {'after' in s && <p className="mt-2 leading-7 text-neutral-700">{s.after}</p>}
        </section>
      ))}
      <div className="mt-8 space-y-2">
        <p>
          <Link href="/safety" className="font-semibold text-brand-800 underline">
            {t.safety}
          </Link>
        </p>
        <p>
          <Link href="/impressum" className="text-sm text-neutral-600 underline">
            {t.impressum}
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
