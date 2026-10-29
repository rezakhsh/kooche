'use client';

import { useActionState, useEffect } from 'react';
import { useTurnstile } from '../../../components/turnstile';
import { Alert, Button, Field } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import { joinWaitlistAction, type WaitlistState } from '../../waitlist/actions';

/**
 * "Notify me" on a city's waitlist page: email, who you are, Turnstile; `rewardLeft`: the button
 * keeps the free bump («…و نردبانم را نگه دار»). On a country's page (wave 2 part 8) `cities` puts
 * its waitlist cities first as chips, the first one chosen.
 */
export function WaitlistForm({
  cityId,
  cities,
  turnstileSiteKey,
  rewardLeft = false,
}: {
  cityId?: string;
  cities?: Array<{ id: string; nameFa: string }>;
  turnstileSiteKey: string | null;
  rewardLeft?: boolean;
}) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlistAction, undefined);
  const turnstile = useTurnstile(turnstileSiteKey, 'waitlist');
  const { reset } = turnstile;
  useEffect(() => {
    if (state) reset();
  }, [state, reset]);
  const t = messages.launch;
  if (state && 'sent' in state) return <Alert tone="success">{t.sent}</Alert>;
  return (
    <form action={action} className="space-y-4">
      {cities ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">{messages.countryPage.cityLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {cities.map((c, i) => (
              <label
                key={c.id}
                className="flex h-10 cursor-pointer items-center rounded-full border border-neutral-300 px-4 text-sm has-[:checked]:border-2 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:font-bold has-[:checked]:text-brand-800 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600"
              >
                <input type="radio" name="cityId" value={c.id} defaultChecked={i === 0} className="sr-only" required />
                {c.nameFa}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="cityId" value={cityId} />
      )}
      <Field label={t.emailLabel} name="email" type="email" dir="ltr" inputMode="email" autoComplete="email" placeholder="you@example.com" required />
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">{t.roleLabel}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 text-center text-sm">
          {(Object.keys(t.roles) as Array<keyof typeof t.roles>).map((role, i) => (
            <label key={role} className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-1 leading-5 text-neutral-700 has-[:checked]:bg-white has-[:checked]:font-bold has-[:checked]:text-neutral-900 has-[:checked]:shadow-sm">
              <input type="radio" name="role" value={role} defaultChecked={i === 0} className="sr-only" required />
              {t.roles[role]}
            </label>
          ))}
        </div>
      </fieldset>
      {turnstile.widget}
      {state && 'error' in state && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending || !turnstile.ready} className="w-full">
        {turnstile.ready ? (rewardLeft ? t.submitReward : t.submit) : messages.turnstile.checking}
      </Button>
      <p className="text-xs leading-6 text-neutral-600">{t.privacy}</p>
    </form>
  );
}
