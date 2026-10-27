import { Icon } from '../../../components/icons';
import { TaskPage } from '../../../components/settings';
import { Alert } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatAgo } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { listDevices } from '../../../modules/users/devices';
import { requireSession } from '../../../modules/users/server';
import { revokeDeviceAction, revokeOtherDevicesAction } from '../actions';

export const metadata = { title: messages.devices.title, robots: { index: false } };

// The devices signed in to the account (no mockup; wave 1 design in the approved style): one
// card with a row per device (this one first and marked), its last activity, and «خروج» on the
// others; signing out of all the others at the bottom.

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ revoked?: string; revokedOthers?: string }> }) {
  const { session } = await requireSession('/account/devices');
  const devices = await listDevices(appDb(), session.userId, session.id);
  const params = await searchParams;
  const zone = webEnv().APP_TIME_ZONE;
  const t = messages.devices;
  const others = devices.filter((d) => !d.current).length;
  const ordered = [...devices].sort((a, b) => Number(b.current) - Number(a.current));

  return (
    <TaskPage title={t.title} back="/account/settings" backLabel={messages.account.back}>
      <p className="text-sm leading-7 text-neutral-700">{t.intro}</p>
      {(params.revoked || params.revokedOthers) && (
        <div className="mt-4">
          <Alert tone="success">{params.revoked ? t.revoked : t.revokedOthers(Number(params.revokedOthers) || 0)}</Alert>
        </div>
      )}
      <ul className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
        {ordered.map((d) => (
          <li key={d.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${d.current ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700'}`}>
              <Icon name="devices" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-[15px]">
                <bdi dir="ltr">
                  {d.browser ?? t.unknownBrowser}، {d.os ?? t.unknownOs}
                </bdi>
                {d.current && <span className="rounded-full bg-brand-50 px-2 text-xs font-bold leading-6 text-brand-800">{t.current}</span>}
              </span>
              <span className="block text-xs text-neutral-600">{t.lastActive(formatAgo(d.lastActiveAt, zone))}</span>
            </span>
            {!d.current && (
              <form action={revokeDeviceAction}>
                <input type="hidden" name="sessionId" value={d.id} />
                <button type="submit" className="flex h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm font-bold text-red-700 hover:bg-red-50">
                  {t.signOut}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {others > 0 ? (
        <form action={revokeOtherDevicesAction} className="mt-4">
          <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 font-bold text-red-700 hover:bg-red-50">
            <Icon name="logout" className="size-5" />
            {t.revokeOthers}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-neutral-600">{t.none}</p>
      )}
    </TaskPage>
  );
}
