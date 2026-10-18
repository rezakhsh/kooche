// The Peydoo logo (approved Oct 17, 2026, option A "magnifier"): a turquoise rounded square with a
// white lens and a saffron dot, the thing you found. The same drawing is in src/app/icon.svg (the
// favicon); scripts/brand-assets.mjs draws the PNG icons and the share image from it.

export function LogoMark({ className = 'size-9', mono = false }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden focusable="false" className={`shrink-0 ${className}`}>
      {mono ? (
        <>
          <circle cx="45" cy="44" r="21" fill="none" stroke="currentColor" strokeWidth="10" />
          <path d="M60 59 75 74" stroke="currentColor" strokeWidth="11" strokeLinecap="round" />
          <circle cx="45" cy="44" r="7.5" fill="currentColor" />
        </>
      ) : (
        <>
          <rect width="100" height="100" rx="26" className="fill-brand-700" />
          <circle cx="45" cy="44" r="21" fill="none" stroke="#fff" strokeWidth="10" />
          <path d="M60 59 75 74" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
          <circle cx="45" cy="44" r="7.5" className="fill-saffron-500" />
        </>
      )}
    </svg>
  );
}
