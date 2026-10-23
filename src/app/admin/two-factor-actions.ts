'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { appDb } from '../../db/drizzle';
import { valkey } from '../../lib/valkey';
import { admin } from '../../messages/fa';
import { confirmTwoFactorSetup, startTwoFactorSetup, verifyStaffCode, type CodeResult } from '../../modules/admin/access';
import { qrPath } from '../../modules/admin/qr';
import { adminHref, staffSession } from '../../modules/admin/server';
import { auth } from '../../modules/users/server';

// The TOTP check and its set-up (src/modules/admin/access.ts). staffSession() answers 404 to
// anyone who isn't staff or didn't come through the secret address.

export type CodeState = { error?: string } | undefined;
export type SetupState = { error?: string; qr?: { size: number; d: string }; secret?: string; backupCodes?: string[] } | undefined;

function refusal(result: Exclude<CodeResult, { ok: true }>, invalid: string): string {
  if (result.reason === 'rate_limited') return admin.rateLimited(Math.ceil((result.retryAfterSeconds ?? 60) / 60));
  return result.reason === 'reused' ? admin.verify.reused : invalid;
}

const deps = () => ({ db: appDb(), redis: valkey(), auth: auth() });

export async function verifyCodeAction(_prev: CodeState, form: FormData): Promise<CodeState> {
  const { state, ctx } = await staffSession();
  if (state.kind === 'setup') redirect(adminHref('/setup'));
  if (state.kind === 'ok') redirect(adminHref());
  const kind = form.get('kind') === 'backup' ? 'backup' : 'totp';
  const result = await verifyStaffCode(deps(), ctx, { code: String(form.get('code') ?? ''), kind, headers: new Headers(await headers()) });
  if (!result.ok) return { error: refusal(result, admin.verify.invalid) };
  redirect(adminHref());
}

export async function startSetupAction(): Promise<SetupState> {
  const { state } = await staffSession();
  if (state.kind !== 'setup') redirect(adminHref());
  const { totpURI, backupCodes } = await startTwoFactorSetup(auth(), new Headers(await headers()));
  return { qr: qrPath(totpURI), secret: new URL(totpURI).searchParams.get('secret') ?? '', backupCodes };
}

export async function confirmSetupAction(prev: SetupState, form: FormData): Promise<SetupState> {
  const { state, ctx } = await staffSession();
  if (state.kind !== 'setup') redirect(adminHref());
  const result = await confirmTwoFactorSetup(deps(), ctx, { code: String(form.get('code') ?? ''), headers: new Headers(await headers()) });
  if (!result.ok) return { ...prev, error: refusal(result, admin.setup.invalid) };
  redirect(adminHref('/verify?after=setup'));
}
