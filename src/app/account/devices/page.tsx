import { Alert, Button, Card, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatDateTime } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { listDevices } from '../../../modules/users/devices';
import { requireSession } from '../../../modules/users/server';
import { revokeDeviceAction, revokeOtherDevicesAction } from '../actions';

export const metadata = { title: messages.devices.title, robots: { index: false } };

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ revoked?: string; revokedOthers?: string }>;
}) {
  const { session } = await requireSession('/account/devices');
  const devices = await listDevices(appDb(), session.userId, session.id);
  const params = await searchParams;
  const zone = webEnv().APP_TIME_ZONE;
  const t = messages.devices;
  const others = devices.filter((d) => !d.current).length;

  return (
    <PageShell title={t.title}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-neutral-600">{t.intro}</p>
        {params.revoked && <Alert tone="success">{t.revoked}</Alert>}
        {params.revokedOthers && (
          <Alert tone="success">{t.revokedOthers(Number(params.revokedOthers) || 0)}</Alert>
        )}

        <ul className="space-y-3">
          {devices.map((d) => (
            <li key={d.id}>
              <Card className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    <span dir="ltr">
                      {d.browser ?? t.unknownBrowser} · {d.os ?? t.unknownOs}
                    </span>
                  </p>
                  {d.current && (
                    <span className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-800">
                      {t.current}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">{t.signedIn(formatDateTime(d.createdAt, zone))}</p>
                <p className="text-xs text-neutral-500">
                  {t.lastActive(formatDateTime(d.lastActiveAt, zone))}
                </p>
                {!d.current && (
                  <form action={revokeDeviceAction}>
                    <input type="hidden" name="sessionId" value={d.id} />
                    <Button type="submit" variant="danger" className="w-full">
                      {t.revoke}
                    </Button>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>

        {others > 0 ? (
          <form action={revokeOtherDevicesAction}>
            <Button type="submit" variant="danger" className="w-full">
              {t.revokeOthers}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-neutral-500">{t.none}</p>
        )}
      </div>
    </PageShell>
  );
}
