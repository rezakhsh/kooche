'use client';

import { useCallback, useRef, useState } from 'react';
import { messages } from '../../messages/fa';
import { PhotoEditor } from '../my/listings/[id]/photos';
import type { PhotoView } from '../my/listings/photo-view';
import { startEventDraftAction } from './actions';
import { EventForm, type EventFormProps } from './form';

// Poster, photos and form of one event. Like a listing, a new event exists only in the browser
// until the organizer saves it or adds the first photo; then the draft is created once and the
// address bar moves to /my/events/<id> without reloading. The draft needs the event type, so the
// photos come right after the type, never before it.

export function EventEditor({ form, photos }: { form: EventFormProps; photos: { max: number; initial: PhotoView[]; enabled: boolean } }) {
  const [listingId, setListingId] = useState(form.listingId);
  const [categoryId, setCategoryId] = useState(form.values.categoryId);
  const pending = useRef<Promise<string> | null>(null);

  const adopt = useCallback((id: string) => {
    setListingId(id);
    window.history.replaceState(null, '', `/my/events/${id}`);
  }, []);

  const ensureListing = useCallback(async () => {
    if (listingId) return listingId;
    if (!categoryId) throw new Error(messages.events.form.typeFirst);
    // Two quick photo picks must not start two drafts
    pending.current ??= startEventDraftAction(categoryId).then((r) => {
      if (!r.ok) {
        pending.current = null;
        throw new Error(r.error);
      }
      adopt(r.listingId);
      return r.listingId;
    });
    return pending.current;
  }, [listingId, categoryId, adopt]);

  return (
    <EventForm
      {...form}
      listingId={listingId}
      onDraftCreated={adopt}
      onTypeChange={setCategoryId}
      photos={
        <div className="space-y-2">
          <h2 className="font-semibold">{messages.events.form.photos}</h2>
          <p className="text-xs text-neutral-500">{listingId || categoryId ? messages.events.form.photosHint : messages.events.form.typeFirst}</p>
          <PhotoEditor listingId={listingId} ensureListing={ensureListing} {...photos} />
        </div>
      }
    />
  );
}
