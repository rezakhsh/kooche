// Small drawn flags (emoji flags don't show on Windows): the open countries and the ones with a
// waitlist city (the city chooser). A country without a drawing gets its two-letter code in a grey
// box; add its flag here when it gets a waitlist or opens.

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
  NL: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6.67" fill="#ae1c28" />
      <rect y="13.33" width="30" height="6.67" fill="#21468b" />
    </>
  ),
  CA: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="7.5" height="20" fill="#d52b1e" />
      <rect x="22.5" width="7.5" height="20" fill="#d52b1e" />
      <path d="M15 4l1.6 3.4 2.4-.8-1 3.6 2-.4-3.5 3.4.4 2.3-1.9-.6-1.9.6.4-2.3-3.5-3.4 2 .4-1-3.6 2.4.8z" fill="#d52b1e" />
    </>
  ),
  US: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect y="0.0" width="30" height="1.538" fill="#b22234" />
      <rect y="3.077" width="30" height="1.538" fill="#b22234" />
      <rect y="6.154" width="30" height="1.538" fill="#b22234" />
      <rect y="9.231" width="30" height="1.538" fill="#b22234" />
      <rect y="12.308" width="30" height="1.538" fill="#b22234" />
      <rect y="15.385" width="30" height="1.538" fill="#b22234" />
      <rect y="18.462" width="30" height="1.538" fill="#b22234" />
      <rect width="13" height="10.8" fill="#3c3b6e" />
    </>
  ),
  AU: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0l15 10M15 0L0 10" stroke="#fff" strokeWidth="2" />
      <path d="M7.5 0v10M0 5h15" stroke="#fff" strokeWidth="3" />
      <path d="M7.5 0v10M0 5h15" stroke="#c8102e" strokeWidth="1.6" />
      <circle cx="7.5" cy="15" r="1.6" fill="#fff" />
      <circle cx="23" cy="5" r="1" fill="#fff" />
      <circle cx="20" cy="10" r="1" fill="#fff" />
      <circle cx="25.5" cy="9" r="1" fill="#fff" />
      <circle cx="23" cy="16" r="1" fill="#fff" />
    </>
  ),
  GB: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="3.6" />
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
