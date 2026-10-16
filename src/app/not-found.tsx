import Link from 'next/link';
import { messages } from '../messages/fa';

// Replaces Next's built-in 404 page, which is in English and uses inline styles the CSP blocks.
export default function NotFound() {
  const t = messages.notFound;
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <p className="mt-4 text-lg text-neutral-700">{t.body}</p>
      <Link href="/" className="mt-8 w-fit text-emerald-700 underline underline-offset-4">
        {t.home}
      </Link>
    </main>
  );
}
