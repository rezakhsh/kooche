// Right-to-left for plain text we send outside our own pages (emails' text part and subject,
// Telegram messages). Mail apps and Telegram choose a line's direction from its first strong
// character, so a line that starts with a Latin name («TaskPilot» تأیید شد) or a digit runs left to
// right and its final «.» jumps to the wrong side. A Right-to-Left Mark (U+200F) at the start of
// each line fixes the direction without changing what the line says. Links stay untouched, so
// apps still recognise them.

const RLM = '\u200F';
/** Left-to-Right Mark: a line that must stay left to right (German legal text in a receipt) */
const LRM = '\u200E';

export function rtlLine(line: string): string {
  return line === '' || line.startsWith(RLM) || line.startsWith(LRM) || /^https?:\/\//.test(line) ? line : `${RLM}${line}`;
}

/** Keeps one line left to right inside right-to-left text */
export function ltrLine(line: string): string {
  return line.startsWith(LRM) ? line : `${LRM}${line}`;
}

export function rtlLines(text: string): string {
  return text.split('\n').map(rtlLine).join('\n');
}

/**
 * Shortens a one-line title at a word, with «…» at its logical end. The browser's own ellipsis
 * cuts the visual left edge, so a right-to-left title ending in Latin lost that word's start
 * («…annplatz» for «نزدیک Hermannplatz»; design check, Oct 31, 2026).
 */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s،,.:;-]+$/, '')}…`;
}
