// "Add to calendar": an iCalendar file (RFC 5545) with one entry per date, which phones and
// desktop calendars open directly. Times in UTC, so no time-zone table is needed. Made on request,
// nothing stored.

export type IcsEvent = {
  token: string;
  title: string;
  description: string;
  url: string;
  /** Venue, address and place, as one line */
  location: string | null;
  cancelled: boolean;
  dates: { startsAt: Date; endsAt: Date }[];
  /** When the event was last changed and its revision, so calendars update a saved entry */
  updatedAt: Date;
  sequence: number;
  /** Host of APP_URL, for the entries' unique ids */
  host: string;
};

const MAX_DESCRIPTION = 1000;

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Text value escaping (RFC 5545, 3.3.11) */
function text(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 octets are folded, without cutting a character in half */
function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = bytes.encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(e: IcsEvent): string {
  const description = e.description.length > MAX_DESCRIPTION ? `${e.description.slice(0, MAX_DESCRIPTION)}…` : e.description;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Peydoo//Events//FA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const d of e.dates) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.token}-${stamp(d.startsAt)}@${e.host}`,
      `DTSTAMP:${stamp(e.updatedAt)}`,
      `DTSTART:${stamp(d.startsAt)}`,
      `DTEND:${stamp(d.endsAt)}`,
      `SUMMARY:${text(e.title)}`,
      `DESCRIPTION:${text(`${description}\n\n${e.url}`)}`,
      `URL:${e.url}`,
    );
    if (e.location) lines.push(`LOCATION:${text(e.location)}`);
    lines.push(`STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`, `SEQUENCE:${e.sequence}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
