// Addresses of the browse pages (approved Oct 18, 2026): Latin slugs from the seed.
//   /{country}                    /germany
//   /{country}/{category}         /germany/cars
//   /{country}/{city}             /germany/berlin
//   /{country}/{city}/{category}  /germany/berlin/cars
//   /{country}/{city}/events      /germany/berlin/events
// City and category slugs never clash (a seed check), so one segment after the country is either.

export function browsePath(country: string, city: string | null, category: string | null): string {
  return `/${[country, city, category].filter(Boolean).join('/')}`;
}

export function eventsPath(country: string, city: string | null): string {
  return city ? `/${country}/${city}/events` : `/${country}/events`;
}
