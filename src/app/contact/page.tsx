import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, LinkButton, PageShell } from '../../components/ui';
import { webEnv } from '../../lib/env';
import { messages, pages } from '../../messages/fa';
import { operator } from '../../messages/operator';
import { turnstileSiteKey } from '../../modules/security/server';
import { formTime } from '../../modules/users/contact';
import { CONTACT_TOPICS, isContactTopic, TOPIC_RULES } from '../../modules/users/contact-topics';
import { currentSession } from '../../modules/users/server';
import { ContactForm } from './contact-form';

// Contact: the email address (DSA art. 12 point of contact for users, art. 16 notices) and the
// contact form, the second quick channel the Impressum needs (§ 5 DDG). Help first: a topic, its
// answers from the help page, and only then the form (src/modules/users/contact.ts). Links, not
// script: /contact?topic=…, then &write=1 for the form.

export const metadata: Metadata = { title: pages.contact.title, description: pages.contact.intro, alternates: { canonical: '/contact' } };

const helpAnswers = (questions: readonly string[]) =>
  pages.help.groups.flatMap((g) => g.items as readonly { q: string; a: string }[]).filter((i) => questions.includes(i.q));

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; write?: string }> }) {
  const t = pages.contact;
  const f = messages.contactForm;
  const sp = await searchParams;
  const topic = isContactTopic(sp.topic) ? sp.topic : null;
  const rule = topic ? TOPIC_RULES[topic] : null;
  const answers = rule ? helpAnswers(rule.help) : [];
  const writing = !!topic && (sp.write === '1' || answers.length === 0);
  const session = writing ? await currentSession() : null;
  const here = topic ? `/contact?topic=${topic}&write=1#form` : '/contact#form';
  return (
    <PageShell title={t.title} wide>
      <p className="leading-7 text-neutral-700">{t.intro}</p>
      <section id="form" className="mt-8 scroll-mt-20">
        <h2 className="text-lg font-extrabold">{f.heading}</h2>
        {!topic ? (
          <>
            <p className="mt-2 mb-4 leading-7 text-neutral-700">{f.pick}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {CONTACT_TOPICS.map((k) => (
                <li key={k}>
                  <Link
                    href={`/contact?topic=${k}#form`}
                    className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:border-brand-300 hover:bg-brand-50"
                  >
                    {f.topics[k]}
                    <span aria-hidden className="text-neutral-400">‹</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="mt-2 space-y-4">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-bold text-neutral-900">{f.topics[topic]}</span>
              <Link href="/contact#form" className="text-brand-800 underline">
                {f.changeTopic}
              </Link>
            </p>
            {topic === 'illegal' && <Alert tone="info">{f.illegalHint}</Alert>}
            {topic === 'authority' && <Alert tone="info">{f.authorityHint(operator.authoritiesEmail)}</Alert>}
            {answers.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-neutral-700">{f.answersFirst}</p>
                <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
                  {answers.map((item) => (
                    <details key={item.q} className="group px-4 py-3">
                      <summary className="cursor-pointer list-none font-semibold text-neutral-900 marker:hidden">
                        <span className="flex items-center justify-between gap-3">
                          {item.q}
                          <span aria-hidden className="text-neutral-500 transition-transform group-open:rotate-45">
                            +
                          </span>
                        </span>
                      </summary>
                      <p className="mt-2 leading-7 text-neutral-700">{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
            {!writing ? (
              <LinkButton href={`/contact?topic=${topic}&write=1#form`} variant="secondary" className="w-full">
                {f.notAnswered}
              </LinkButton>
            ) : !session && !rule!.guests ? (
              <Alert tone="info">
                {f.signInFirst}{' '}
                <Link href={`/login?next=${encodeURIComponent(here)}`} className="font-bold underline">
                  {f.signIn}
                </Link>
              </Alert>
            ) : (
              <ContactForm
                topic={topic}
                signedIn={!!session}
                name={session?.user.name ?? ''}
                email={session?.user.email ?? null}
                turnstileSiteKey={turnstileSiteKey()}
                formTime={formTime(webEnv().AUTH_SECRET)}
              />
            )}
          </div>
        )}
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
