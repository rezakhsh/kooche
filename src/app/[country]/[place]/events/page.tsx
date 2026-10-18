import type { Metadata } from 'next';
import { EventsList, eventsMetadata, type EventsParams, type EventsSearch } from '../../events/events-list';

// /germany/berlin/events: a city's events. Only cities have events pages; /germany/cars/events is a 404.

type Props = { params: Promise<EventsParams>; searchParams: Promise<EventsSearch> };

export function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return eventsMetadata(params, searchParams);
}

export default function CityEventsPage({ params, searchParams }: Props) {
  return <EventsList params={params} searchParams={searchParams} />;
}
