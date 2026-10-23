import { redirect } from 'next/navigation';
import { Alert } from '../../../components/ui';
import { admin } from '../../../messages/fa';
import { adminHref, staffSession } from '../../../modules/admin/server';
import { CodeForm } from './code-form';

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { state } = await staffSession();
  if (state.kind === 'setup') redirect(adminHref('/setup'));
  if (state.kind === 'ok') redirect(adminHref());
  const after = (await searchParams).after === 'setup';
  const t = admin.verify;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-extrabold">{t.title}</h1>
      {after && <div className="mb-4"><Alert tone="success">{t.afterSetup}</Alert></div>}
      <p className="mb-6 text-sm text-neutral-700">{t.intro}</p>
      <CodeForm />
    </div>
  );
}
