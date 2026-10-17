'use client';

import { useCallback, useRef, useState } from 'react';
import { startDraftAction } from '../actions';
import type { PhotoView } from '../photo-view';
import { ListingForm, type FormProps } from './form';
import { PhotoEditor } from './photos';

// Photos and form of one listing. A new listing exists only in the browser until the seller
// saves it or adds the first photo; then the draft is created once and the address bar moves to
// /my/listings/<id> without reloading, so nothing typed is lost.

export function ListingEditor({
  form,
  photos,
}: {
  form: FormProps;
  photos: { max: number; initial: PhotoView[]; enabled: boolean };
}) {
  const [listingId, setListingId] = useState(form.listingId);
  const pending = useRef<Promise<string> | null>(null);

  const adopt = useCallback((id: string) => {
    setListingId(id);
    window.history.replaceState(null, '', `/my/listings/${id}`);
  }, []);

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

  return (
    <>
      <PhotoEditor listingId={listingId} ensureListing={ensureListing} {...photos} />
      <ListingForm {...form} listingId={listingId} onDraftCreated={adopt} />
    </>
  );
}
