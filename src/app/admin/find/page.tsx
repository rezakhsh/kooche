import { redirect } from 'next/navigation';
import { normalizePersian } from '../../../lib/normalize-persian';
import { adminHref, requireStaff } from '../../../modules/admin/server';

// The bar's search (wave 1, mockup ui.js adminShell: «کد آگهی، ایمیل یا نام»): a code, a pasted
// address or a token goes to the listings search, everything else (email, phone, name) to users.

export default async function FindPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('overview.view');
  const q = ((await searchParams).q ?? '').trim().slice(0, 300);
  if (!q) redirect(adminHref());
  const plain = normalizePersian(q);
  const listing = /^\d{5,}$/.test(plain.replace(/\s/g, '')) || /^https?:\/\/|\/(v|e)\//.test(plain);
  redirect(adminHref(`/${listing ? 'listings' : 'users'}?q=${encodeURIComponent(q)}`));
}
