'use client';

import { useCallback, useRef, useState } from 'react';
import { Icon } from '../../../../components/icons';
import { messages } from '../../../../messages/fa';
import { startDraftAction } from '../actions';
import type { PhotoView } from '../photo-view';
import { ListingForm, type FormProps } from './form';
import { PhotoEditor } from './photos';
import type { Step } from './steps';

// Photos and form of one listing. A new listing exists only in the browser until the seller
// saves it or adds the first photo; then the draft is created once and the address bar moves to
// /my/listings/<id> without reloading, so nothing typed is lost.
// A draft is filled in steps (wave 1, ./steps.ts): the step lives here, because the photos belong
// to step 2 and the check at step 4 counts them; the address keeps it (?step=3), so a reload
// stays on the same step.

export function ListingEditor({
  form,
  photos,
  initialStep = 2,
}: {
  form: FormProps;
  photos: { max: number; initial: PhotoView[]; enabled: boolean };
  initialStep?: Step;
}) {
  const [listingId, setListingId] = useState(form.listingId);
  const pending = useRef<Promise<string> | null>(null);
  const stepping = form.status === 'draft';
  const [step, setStepState] = useState<Step>(initialStep);
  const [photoCount, setPhotoCount] = useState(photos.initial.length);

  const address = (id: string | null, s: Step) => `${id ? `/my/listings/${id}` : window.location.pathname}${stepping ? `?step=${s}` : ''}`;

  const adopt = useCallback(
    (id: string) => {
      setListingId(id);
      window.history.replaceState(null, '', address(id, step));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step],
  );

  const setStep = useCallback(
    (s: Step) => {
      setStepState(s);
      window.history.replaceState(null, '', address(listingId, s));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listingId],
  );

  const ensureListing = useCallback(async () => {
    if (listingId) return listingId;
    // Two quick photo picks must not start two drafts
    pending.current ??= startDraftAction(form.categoryId).then((r) => {
      if (!r.ok) {
        pending.current = null;
        throw new Error(r.error);
      }
      adopt(r.listingId);
      return r.listingId;
    });
    return pending.current;
  }, [listingId, form.categoryId, adopt]);

  const t = messages.form;
  const names: readonly string[] = t.steps;
  return (
    <>
      {stepping && (
        <div data-step-bar>
          <ol className="grid grid-cols-4 gap-1.5" aria-hidden>
            {names.map((n, i) => (
              <li key={n} className={`h-1.5 rounded-full ${i < step ? 'bg-brand-700' : 'bg-neutral-200'}`} />
            ))}
          </ol>
          <p className="mt-2 flex items-center justify-between gap-2 text-xs">
            <b className="text-brand-800">{t.stepOf(step, names.length, names[step - 1]!)}</b>
            {listingId && (
              <span className="flex items-center gap-1 text-neutral-600">
                <Icon name="check" className="size-3.5" />
                {t.draftSaved}
              </span>
            )}
          </p>
          <h1 className="mt-4 text-2xl font-extrabold">{t.stepHeadings[step]}</h1>
          {step === 2 && <p className="mt-1 text-sm text-neutral-600">{t.photosLead}</p>}
        </div>
      )}
      <div data-step={stepping ? 2 : undefined} className={stepping && step !== 2 ? 'hidden' : undefined}>
        <PhotoEditor listingId={listingId} ensureListing={ensureListing} onCount={setPhotoCount} {...photos} />
      </div>
      <ListingForm {...form} listingId={listingId} onDraftCreated={adopt} wizard={stepping ? { step, setStep, photoCount } : null} />
    </>
  );
}
