'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { appDb } from '../../../db/drizzle';
import { clientIp } from '../../../lib/client-ip';
import { webEnv } from '../../../lib/env';
import { hit } from '../../../lib/rate-limit';
import { normalizePersian } from '../../../lib/normalize-persian';
import { valkey } from '../../../lib/valkey';
import { messages } from '../../../messages/fa';
import { LIMITS } from '../../../modules/users/limits';
import {
  checkSmsCode,
  startSmsVerification,
  startTelegramVerification,
} from '../../../modules/users/phone';
import { maskPhone, parseSmsNumber } from '../../../modules/users/phone-number';
import { requireSession, sms } from '../../../modules/users/server';

export type TelegramState =
  | { link: string; verificationId: string }
  | { error: string }
  | undefined;

export type SmsState =
  | { step: 'number'; error?: string }
  | { step: 'code'; verificationId: string; masked: string; error?: string }
  | { step: 'done' };

function minutes(seconds: number): string {
  return messages.rateLimited(Math.max(1, Math.ceil(seconds / 60)));
}

async function limitStart(userId: string): Promise<string | null> {
  const ip = clientIp(await headers());
  const result = await hit(valkey(), [
    [LIMITS.phoneStartPerUserHour, userId],
    [LIMITS.phoneStartPerUserDay, userId],
    ...(ip ? ([[LIMITS.phoneStartPerIp, ip]] as const) : []),
  ]);
  return result.ok ? null : minutes(result.retryAfterSeconds);
}

export async function startTelegram(_: TelegramState): Promise<TelegramState> {
  const { user } = await requireSession('/account/phone');
  const limited = await limitStart(user.id);
  if (limited) return { error: limited };

  const { token, verificationId } = await startTelegramVerification(appDb(), {
    userId: user.id,
    ip: clientIp(await headers()),
  });
  return {
    link: `https://t.me/${webEnv().TELEGRAM_BOT_USERNAME}?start=${token}`,
    verificationId,
  };
}

/** The SMS form's one action: `intent` is `send` (number step) or `check` (code step). */
export async function smsAction(state: SmsState, form: FormData): Promise<SmsState> {
  return form.get('intent') === 'check' ? checkSms(state, form) : sendSms(form);
}

async function sendSms(form: FormData): Promise<SmsState> {
  const { user } = await requireSession('/account/phone/sms');
  const t = messages.sms;
  const parsed = parseSmsNumber(String(form.get('phone') ?? ''));
  if (!parsed.ok) {
    const error = {
      invalid: t.invalid,
      not_mobile: t.notMobile,
      country_not_supported: t.countryNotSupported,
    }[parsed.reason];
    return { step: 'number', error };
  }

  const limited = await limitStart(user.id);
  if (limited) return { step: 'number', error: limited };
  const perNumber = await hit(valkey(), [[LIMITS.smsPerNumberDay, parsed.e164]]);
  if (!perNumber.ok) return { step: 'number', error: minutes(perNumber.retryAfterSeconds) };

  const result = await startSmsVerification(appDb(), sms(), {
    userId: user.id,
    phoneE164: parsed.e164,
    ip: clientIp(await headers()),
    secret: webEnv().PHONE_CODE_SECRET,
  });
  if (!result.ok) return { step: 'number', error: messages.phone.failed[result.reason] };
  return { step: 'code', verificationId: result.verificationId, masked: maskPhone(parsed.e164) };
}

const checkSchema = z.object({
  verificationId: z.uuid(),
  masked: z.string().max(20),
  code: z.string().regex(/^[0-9]{6}$/),
});

async function checkSms(state: SmsState, form: FormData): Promise<SmsState> {
  const { user } = await requireSession('/account/phone/sms');
  const t = messages.sms;
  const input = checkSchema.safeParse({
    verificationId: form.get('verificationId'),
    masked: form.get('masked'),
    code: normalizePersian(String(form.get('code') ?? '')).replace(/\s/g, ''),
  });
  if (!input.success) {
    return state.step === 'code' ? { ...state, error: messages.code.invalid } : { step: 'number' };
  }
  const { verificationId, masked, code } = input.data;

  const limit = await hit(valkey(), [[LIMITS.smsCheckPerUser, user.id]]);
  if (!limit.ok) return { step: 'code', verificationId, masked, error: minutes(limit.retryAfterSeconds) };

  const result = await checkSmsCode(appDb(), {
    userId: user.id,
    verificationId,
    code,
    secret: webEnv().PHONE_CODE_SECRET,
  });
  if (result.ok) return { step: 'done' };
  switch (result.reason) {
    case 'wrong_code':
      return { step: 'code', verificationId, masked, error: t.wrongCode(result.attemptsLeft ?? 0) };
    case 'expired':
      return { step: 'number', error: t.expired };
    case 'not_found':
      return { step: 'number', error: t.notFound };
    case 'too_many_attempts':
      return { step: 'number', error: messages.phone.failed.too_many_attempts };
    case 'phone_in_use':
      return { step: 'number', error: messages.phone.failed.phone_in_use };
  }
}
