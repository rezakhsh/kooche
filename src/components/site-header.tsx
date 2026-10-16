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
        <Link
          href={session ? '/account' : '/login'}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          {session ? t.account : t.signIn}
        </Link>
      </div>
    </header>
  );
}
