'use client';

import { useActionState } from 'react';
import { PlaceField, type PlaceFieldValue } from '../../../components/place-field';
import { Alert, Button } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import { savePlaceAction, type PlaceState } from './actions';

export function SavedPlaceForm({ countries, initial, hasPlace }: { countries: { code: string; nameFa: string }[]; initial: PlaceFieldValue; hasPlace: boolean }) {
  const [state, dispatch, pending] = useActionState<PlaceState, FormData>(savePlaceAction, undefined);
  const t = messages.account;
  return (
    <form action={dispatch} className="space-y-4">
      <PlaceField countries={countries} initial={initial} allowArea={false} errors={state?.errors} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.notice && <Alert tone="success">{state.notice}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button type="submit" name="intent" value="save" disabled={pending} className="sm:flex-1">
          {t.placeSave}
        </Button>
        {hasPlace && (
          <Button type="submit" name="intent" value="remove" variant="secondary" disabled={pending} className="sm:flex-1">
            {t.placeRemove}
          </Button>
        )}
      </div>
    </form>
  );
}
