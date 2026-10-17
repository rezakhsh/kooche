import Link from 'next/link';
import { messages } from '../messages/fa';
import { currentSession } from '../modules/users/server';

export async function SiteHeader() {
  const session = await currentSession();
  const t = messages.header;
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-bold text-emerald-800">
          {messages.site.name}
        </Link>
        <nav className="flex items-center gap-2">
          {session && (
            <Link href="/my/listings" className="hidden rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-50 sm:inline-block">
              {t.myListings}
            </Link>
          )}
          <Link href="/new" className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            {t.post}
          </Link>
          <Link
            href={session ? '/account' : '/login'}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            {session ? t.account : t.signIn}
          </Link>
        </nav>
      </div>
    </header>
  );
}
