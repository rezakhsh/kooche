import Link from 'next/link';
import { headers } from 'next/headers';
import { isIranRequest } from '../lib/region';
import { messages } from '../messages/fa';
import { currentSession } from '../modules/users/server';
import { Icon } from './icons';
import { Alert } from './ui';

// People in Iran (src/lib/region.ts): the banner on every page and the notice that replaces the pay
// buttons. Only shown to requests from Iran, whose pages are never kept by Cloudflare (src/proxy.ts).

export async function fromIran(): Promise<boolean> {
  return isIranRequest(await headers());
}

export async function IranBanner() {
  if (!(await fromIran())) return null;
  const t = messages.iran.banner;
  const session = await currentSession();
  const pill = 'flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold';
  // A card above the page (wave 1, mockup final/iran); the mockup's header pill «دیدن و پیام» and
  // four-item bar are left out, since people in Iran may now do everything but pay (Oct 27, 2026)
  return (
    <div data-iran-banner className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
      <section className="rounded-2xl border border-brand-200 bg-brand-50 p-4 lg:flex lg:items-start lg:gap-4">
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 lg:flex">
          <Icon name="globe" className="size-6" />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-extrabold text-brand-900 lg:text-lg">{t.title}</h2>
          <p className="mt-1 text-sm leading-7 text-neutral-800">{t.body}</p>
          <p className="mt-2 text-sm leading-7 text-neutral-800">{session ? t.traveling : t.guest}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!session && (
              <Link href="/login" className={`${pill} bg-brand-700 text-white hover:bg-brand-800`}>
                <Icon name="mail" className="size-4" />
                {t.signUp}
              </Link>
            )}
            <Link href="/help#iran" className={`${pill} bg-white text-brand-800 hover:bg-brand-100`}>
              <Icon name="book" className="size-4" />
              {t.guide}
            </Link>
            <Link href="/help#iran" className={`${pill} text-brand-800 underline`}>
              {t.why}
            </Link>
            <Link href="/report" className={`${pill} text-neutral-700`}>
              <Icon name="flag" className="size-4" />
              {t.report}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Instead of the pay buttons: paying isn't possible from Iran (src/modules/payments/checkout.ts) */
export function IranPaymentNotice() {
  return <Alert tone="info">{messages.iran.payments}</Alert>;
}
