// Small drawn flags for the open countries (emoji flags don't show on Windows). A country without
// a drawing yet gets its two-letter code in a grey box; add its flag here when it opens.

const FLAGS: Record<string, React.ReactNode> = {
  DE: (
    <>
      <rect width="30" height="20" fill="#000" />
      <rect y="6.67" width="30" height="6.67" fill="#dd0000" />
      <rect y="13.33" width="30" height="6.67" fill="#ffce00" />
    </>
  ),
  AT: (
    <>
      <rect width="30" height="20" fill="#c8102e" />
      <rect y="6.67" width="30" height="6.67" fill="#fff" />
    </>
  ),
};

export function Flag({ code, className = 'h-5 w-7.5' }: { code: string; className?: string }) {
  const drawing = FLAGS[code];
  if (!drawing) {
    return (
      <span aria-hidden className={`inline-flex items-center justify-center rounded-sm bg-neutral-200 text-xs font-bold text-neutral-600 ${className}`}>
        {code}
      </span>
    );
  }
  return (
    <svg viewBox="0 0 30 20" aria-hidden focusable="false" className={`shrink-0 overflow-hidden rounded-sm ring-1 ring-neutral-900/10 ${className}`}>
      {drawing}
    </svg>
  );
}
