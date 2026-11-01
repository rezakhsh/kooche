import Link from 'next/link';
import { cookies } from 'next/headers';
import { appDb } from '../db/drizzle';
import { pages } from '../messages/fa';
import { LEGAL_SEEN_COOKIE, nextPath, waitingNotice } from '../modules/legal/notices';
import { dayFa } from '../modules/legal/versions';
import { currentSession } from '../modules/users/server';
import { dismissLegalBannerAction } from '../app/legal-actions';
import { Icon } from './icons';

// The line at the top for signed-in people after «خبر تغییر شرایط به همه» went out, until the new
// version's day (src/modules/legal/notices.ts): what changes when, a link to the new text, and
// «بستن» (a cookie per notice). Not on the admin page (globals.css).

export async function LegalChangeBanner() {
  const session = await currentSession();
  if (!session) return null;
  const notice = await waitingNotice(appDb()).catch(() => null);
  if (!notice || (await cookies()).get(LEGAL_SEEN_COOKIE)?.value === notice.id) return null;
  const t = pages.legal;
  const docs = notice.documents.length === 2 ? 'both' : notice.documents[0]!;
  return (
    <div data-legal-banner className="border-b border-brand-200 bg-brand-50">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5 text-sm sm:px-6">
        <p className="min-w-0 flex-1 text-brand-800">
          {t.banner(docs, dayFa(notice.effectiveOn))}{' '}
          <Link href={nextPath(notice.documents[0]!)} className="font-bold whitespace-nowrap underline">
            {t.bannerLink}
          </Link>
        </p>
        <form action={dismissLegalBannerAction}>
          <input type="hidden" name="id" value={notice.id} />
          <button type="submit" aria-label={t.bannerClose} title={t.bannerClose} className="flex size-8 items-center justify-center rounded-lg text-brand-800 hover:bg-brand-100">
            <Icon name="close" className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
