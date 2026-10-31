import Link from 'next/link';
import { admin } from '../../messages/fa';
import { signOut } from '../account/actions';

// Under the two-factor set-up and code forms: back to the site, or sign out (design check,
// Oct 31, 2026: a staff member without their phone had no way out of these pages).

export function TwoFactorExit() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-5 border-t border-neutral-200 pt-3 text-sm">
      <Link href="/" prefetch={false} className="inline-flex min-h-11 items-center font-medium text-brand-800 hover:underline">
        {admin.shell.back}
      </Link>
      <form action={signOut}>
        <button type="submit" className="inline-flex min-h-11 items-center font-medium text-neutral-700 hover:underline">
          {admin.verify.signOut}
        </button>
      </form>
    </div>
  );
}
