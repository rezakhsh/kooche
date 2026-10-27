// An on/off switch (wave 1, mockup final/notifications): a real checkbox, drawn as a switch, so it
// works in a plain form and with the keyboard.

export function Switch({ name, defaultChecked, label }: { name: string; defaultChecked: boolean; label: string }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} aria-label={label} className="peer absolute inset-0 z-10 cursor-pointer opacity-0" />
      <span
        aria-hidden
        className="inline-flex h-6 w-10 items-center justify-start rounded-full bg-neutral-300 px-0.5 peer-checked:justify-end peer-checked:bg-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2"
      >
        <i className="block size-5 rounded-full bg-white shadow" />
      </span>
    </span>
  );
}
