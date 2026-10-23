import { redirect } from 'next/navigation';
import { admin } from '../../../messages/fa';
import { adminHref, staffSession } from '../../../modules/admin/server';
import { SetupForm } from './setup-form';

export default async function SetupPage() {
  const { state } = await staffSession();
  if (state.kind !== 'setup') redirect(adminHref());
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-extrabold">{admin.setup.title}</h1>
      <p className="mb-6 text-sm text-neutral-700">{admin.setup.intro}</p>
      <SetupForm />
    </div>
  );
}
