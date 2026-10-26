import Link from 'next/link';
import { headers } from 'next/headers';
import { isIranRequest } from '../lib/region';
import { messages } from '../messages/fa';
import { currentSession } from '../modules/users/server';
import { Icon } from './icons';
import { Card, PageShell } from './ui';

// Iran read-only (src/lib/region.ts): the banner on every page and the notice that replaces a form.
// Only shown to requests from Iran, whose pages are never kept by Cloudflare (src/proxy.ts).

export async function fromIran(): Promise<boolean> {
  return isIranRequest(await headers());
}

export async function IranBanner() {
  if (!(await fromIran())) return null;
  const t = messages.iran.banner;
  const session = await currentSession();
  return (
    <section className="border-b border-brand-200 bg-brand-50">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-brand-900">
          <Icon name="globe" className="size-5 shrink-0" />
          {t.title}
        </h2>
        <p className="mt-1 text-sm leading-7 text-neutral-800">{t.body}</p>
        <p className="mt-1 text-sm leading-7 text-neutral-800">{session ? t.traveling : t.moving}</p>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm font-bold">
          <Link href="/help#iran" className="text-brand-800 underline">
            {t.why}
          </Link>
          <Link href="/report" className="text-neutral-700 underline">
            {t.report}
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Instead of a form that would be refused anyway (sign-in, posting, phone, chat) */
export function IranNotice() {
  const t = messages.iran.notice;
  return (
    <PageShell title={t.title}>
      <Card>
        <p className="leading-7 text-neutral-700">{t.body}</p>
        <Link href="/" className="mt-4 inline-block font-bold text-brand-800 underline">
          {t.browse}
        </Link>
      </Card>
    </PageShell>
  );
}
