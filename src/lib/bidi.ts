// Right-to-left for plain text we send outside our own pages (emails' text part and subject,
// Telegram messages). Mail apps and Telegram choose a line's direction from its first strong
// character, so a line that starts with a Latin name («TaskPilot» تأیید شد) or a digit runs left to
// right and its final «.» jumps to the wrong side. A Right-to-Left Mark (U+200F) at the start of
// each line fixes the direction without changing what the line says. Links stay untouched, so
// apps still recognise them.

const RLM = '‏';

export function rtlLine(line: string): string {
  return line === '' || line.startsWith(RLM) || /^https?:\/\//.test(line) ? line : `${RLM}${line}`;
}

export function rtlLines(text: string): string {
  return text.split('\n').map(rtlLine).join('\n');
}
