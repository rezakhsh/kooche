import { chooseThemeAction } from '../app/theme-actions';
import { THEMES, type Theme } from '../app/theme';
import { messages } from '../messages/fa';
import { Icon, type IconName } from './icons';

// Light, dark or automatic (wave 1, part 10): the footer's switch, for everyone, signed in or not.
// Settings › Appearance (src/app/account/appearance) offers the same with previews.

export const THEME_ICONS: Record<Theme, IconName> = { auto: 'devices', light: 'sun', dark: 'moon' };

export function ThemeSwitch({ current }: { current: Theme }) {
  const t = messages.account.appearance;
  return (
    <form action={chooseThemeAction} className="flex items-center gap-2">
      <span id="theme-switch" className="text-xs text-neutral-600">
        {messages.footer.appearance}
      </span>
      <span role="group" aria-labelledby="theme-switch" className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-neutral-200">
        {THEMES.map((k) => (
          <button
            key={k}
            name="theme"
            value={k}
            aria-pressed={k === current}
            className={`flex h-11 items-center gap-1.5 rounded-lg px-3 text-xs ${k === current ? 'bg-brand-700 font-bold text-white' : 'text-neutral-700 hover:bg-neutral-50'}`}
          >
            <Icon name={THEME_ICONS[k]} className="size-4" />
            {t.options[k].name}
          </button>
        ))}
      </span>
    </form>
  );
}
