import type { Metadata } from 'next';
import { EventsList, eventsMetadata, type EventsParams, type EventsSearch } from './events-list';

// /germany/events: the country's events (shared with the city pages in events-list.tsx)

type Props = { params: Promise<EventsParams>; searchParams: Promise<EventsSearch> };

export function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return eventsMetadata(params, searchParams);
}

export default function CountryEventsPage({ params, searchParams }: Props) {
  return <EventsList params={params} searchParams={searchParams} />;
}
