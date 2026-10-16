'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { revokeDevice, revokeOtherDevices } from '../../modules/users/devices';
import { auth, requireSession } from '../../modules/users/server';

export async function signOut(): Promise<void> {
  await auth().api.signOut({ headers: await headers() });
  redirect('/');
}

const sessionId = z.uuid();

export async function revokeDeviceAction(form: FormData): Promise<void> {
  const { session } = await requireSession('/account/devices');
  const id = sessionId.safeParse(form.get('sessionId'));
  // The current device logs out with "sign out" instead
  if (id.success && id.data !== session.id) await revokeDevice(appDb(), session.userId, id.data);
  redirect('/account/devices?revoked=1');
}

export async function revokeOtherDevicesAction(): Promise<void> {
  const { session } = await requireSession('/account/devices');
  const n = await revokeOtherDevices(appDb(), session.userId, session.id);
  redirect(`/account/devices?revokedOthers=${n}`);
}
