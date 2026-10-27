'use client';

import { useCallback, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { messages } from '../../messages/fa';
import { PhotoEditor } from '../my/listings/[id]/photos';
import type { PhotoView } from '../my/listings/photo-view';
import { startEventDraftAction } from './actions';
import { EventForm, type EventFormProps } from './form';
import type { EventStep } from './steps';

// Poster, photos and form of one event. Like a listing, a new event exists only in the browser
// until the organizer saves it or adds the first photo; then the draft is created once and the
// address bar moves to /my/events/<id> without reloading. A draft is filled in three steps (wave 1,
// ./steps.ts); the address keeps the step (?step=2), so a reload stays on it. The poster may come
// before the type (mockup final/post-event1): the draft then starts in the first type, and the
// chosen one replaces it on the next save.

export function EventEditor({ form, photos, initialStep = 1 }: { form: EventFormProps; photos: { max: number; initial: PhotoView[]; enabled: boolean }; initialStep?: EventStep }) {
  const [listingId, setListingId] = useState(form.listingId);
  const [categoryId, setCategoryId] = useState(form.values.categoryId);
  const pending = useRef<Promise<string> | null>(null);
  const stepping = form.status === 'draft';
  const [step, setStepState] = useState<EventStep>(initialStep);
  const [poster, setPoster] = useState<string | null>(photos.initial[0]?.thumb ?? null);
  const onPhotos = useCallback((thumbs: (string | null)[]) => setPoster(thumbs[0] ?? null), []);

  const address = (id: string | null, s: EventStep) => `${id ? `/my/events/${id}` : window.location.pathname}${stepping ? `?step=${s}` : ''}`;

  const adopt = useCallback(
    (id: string) => {
      setListingId(id);
      window.history.replaceState(null, '', address(id, step));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step],
  );

  const setStep = useCallback(
    (s: EventStep) => {
      setStepState(s);
      window.history.replaceState(null, '', address(listingId, s));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listingId],
  );

  const ensureListing = useCallback(async () => {
    if (listingId) return listingId;
    const type = categoryId || form.types[0]?.id;
    if (!type) throw new Error(messages.events.form.typeFirst);
    // Two quick photo picks must not start two drafts
    pending.current ??= startEventDraftAction(type).then((r) => {
      if (!r.ok) {
        pending.current = null;
        throw new Error(r.error);
      }
      adopt(r.listingId);
      return r.listingId;
    });
    return pending.current;
  }, [listingId, categoryId, form.types, adopt]);

  const st = messages.events.steps;
  const names: readonly string[] = st.names;
  return (
    <div className="space-y-2">
      {stepping && (
        <div data-step-bar>
          <ol className="grid grid-cols-3 gap-1.5" aria-hidden>
            {names.map((n, i) => (
              <li key={n} className={`h-1.5 rounded-full ${i < step ? 'bg-brand-700' : 'bg-neutral-200'}`} />
            ))}
          </ol>
          <p className="mt-2 flex items-center justify-between gap-2 text-xs">
            <b className="text-brand-800">{st.of(step, names.length, names[step - 1]!)}</b>
            {listingId && (
              <span className="flex items-center gap-1 text-neutral-600">
                <Icon name="check" className="size-3.5" />
                {st.draftSaved}
              </span>
            )}
          </p>
        </div>
      )}
      <EventForm
        {...form}
        listingId={listingId}
        onDraftCreated={adopt}
        onTypeChange={setCategoryId}
        wizard={stepping ? { step, setStep, poster } : null}
        photos={<PhotoEditor listingId={listingId} ensureListing={ensureListing} onPhotos={onPhotos} bare poster {...photos} />}
      />
    </div>
  );
}
