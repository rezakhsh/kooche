'use client';

import { useCallback, useRef, useState } from 'react';
import { Icon } from '../../../../components/icons';
import { messages } from '../../../../messages/fa';
import { startDraftAction } from '../actions';
import type { PhotoView } from '../photo-view';
import { ListingForm, type FormProps, type Summary } from './form';
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
  const [photoThumbs, setPhotoThumbs] = useState<(string | null)[]>(() => photos.initial.map((p) => p.thumb ?? null));
  const [summary, setSummary] = useState<Summary>({});

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
    <div className={stepping ? 'lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-10' : 'space-y-6'}>
    <div className="min-w-0 space-y-6">
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
          {step === 2 && <p className="mt-1 text-sm text-neutral-600">{t.photosLead(photos.max)}</p>}
        </div>
      )}
      <div data-step={stepping ? 2 : undefined} className={stepping && step !== 2 ? 'hidden' : undefined}>
        <PhotoEditor listingId={listingId} ensureListing={ensureListing} onPhotos={setPhotoThumbs} bare={stepping} {...photos} />
      </div>
      <ListingForm {...form} listingId={listingId} onDraftCreated={adopt} wizard={stepping ? { step, setStep, photos: photoThumbs, onSummary: setSummary } : null} />
    </div>
      {/* Computers: how the card will look, beside steps 3 and 4 (mockup final/post3) */}
      {stepping && step >= 3 && (
        <aside data-step-bar className="sticky top-20 hidden space-y-3 lg:block">
          <div className="rounded-2xl border border-neutral-200 p-3">
            <p className="mb-2 text-xs font-bold text-neutral-600">{t.preview}</p>
            <div className="flex gap-3">
              {photoThumbs[0] ? (
                <img src={photoThumbs[0]} alt="" className="aspect-[4/3] w-28 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="flex aspect-[4/3] w-28 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
                  <Icon name="image" className="size-6" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold leading-6">{summary.title || t.notEntered}</p>
                {summary.price && <p className="font-extrabold text-brand-800">{summary.price}</p>}
                {summary.details && <p className="text-xs text-neutral-600">{summary.details}</p>}
              </div>
            </div>
          </div>
          <p className="text-xs leading-6 text-neutral-600">{t.previewNote}</p>
        </aside>
      )}
    </div>
  );
}
