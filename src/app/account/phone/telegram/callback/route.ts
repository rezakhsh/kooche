import { NextResponse } from 'next/server';
import { appDb } from '../../../../../db/drizzle';
import { webEnv } from '../../../../../lib/env';
import { currentSession, telegramLogin } from '../../../../../modules/users/server';
import { finishTelegramLogin } from '../../../../../modules/users/telegram-oidc';

// Telegram sends the browser back here after "Log in with Telegram" (src/modules/users/
// telegram-oidc.ts). The session cookie is SameSite=Lax, so it comes along on this top-level GET.
// The result goes to /account/phone as ?telegram=<ok or reason>; the code is never shown.

export async function GET(request: Request): Promise<Response> {
  const appUrl = webEnv().APP_URL;
  const back = (result: string) =>
    NextResponse.redirect(`${appUrl}/account/phone?telegram=${result}`, { status: 303, headers: { 'Cache-Control': 'private, no-store' } });

  const session = await currentSession();
  if (!session) return NextResponse.redirect(`${appUrl}/login?next=${encodeURIComponent('/account/phone')}`, 303);
  const config = telegramLogin();
  if (!config) return back('oidc_failed');

  const params = new URL(request.url).searchParams;
  const result = await finishTelegramLogin(appDb(), config.transport, {
    userId: session.user.id,
    state: params.get('state') ?? '',
    code: params.get('code'),
    error: params.get('error'),
    config,
  });
  return back(result.ok ? 'ok' : result.reason === 'country_not_allowed' && result.country === 'IR' ? 'iran' : result.reason);
}
