import { webEnv } from '../lib/env';
import { formatDate } from '../lib/format';
import { messages } from '../messages/fa';

export default function HomePage() {
  const t = messages.home;
  const today = formatDate(new Date(), webEnv().APP_TIME_ZONE);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="mb-4 w-fit rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
        {t.badge}
      </p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{t.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-neutral-700">{t.intro}</p>
      <p className="mt-8 border-s-4 border-emerald-600 ps-3 text-sm text-neutral-500">{t.today(today)}</p>
    </main>
  );
}
