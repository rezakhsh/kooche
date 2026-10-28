import { TaskPage } from '../../../components/settings';
import { Icon } from '../../../components/icons';
import { THEME_ICONS } from '../../../components/theme-switch';
import { messages } from '../../../messages/fa';
import { currentTheme, THEMES } from '../../theme';
import { chooseThemeAction } from '../../theme-actions';

export const metadata = { title: messages.account.appearance.title, robots: { index: false } };

// Settings › Appearance (wave 1, part 10; mockup final/appearance): automatic, light or dark, each
// with a small listing card in that look. No account needed: the choice is a cookie on this device.
// The previews use fixed colours, so each shows its own look whatever the page is in.

function Mini({ dark }: { dark: boolean }) {
  return (
    <span className={`block overflow-hidden rounded-xl border ${dark ? 'border-[#2c3836] bg-[#16211f]' : 'border-[#dce4e2] bg-[#ffffff]'}`}>
      <span className="block aspect-[4/3] w-full bg-gradient-to-br from-[#73b8b9] to-[#fbe6b8]" />
      <span className="block p-2">
        <b className={`block text-xs ${dark ? 'text-[#5cc0c7]' : 'text-[#095a62]'}`}>۸۷۰ €</b>
        <span className={`mt-1 block h-1.5 w-4/5 rounded-full ${dark ? 'bg-[#3a4946]' : 'bg-[#dce4e2]'}`} />
        <span className={`mt-1 block h-1.5 w-1/2 rounded-full ${dark ? 'bg-[#2c3836]' : 'bg-[#ebf0ef]'}`} />
      </span>
    </span>
  );
}

function Preview({ theme }: { theme: (typeof THEMES)[number] }) {
  if (theme !== 'auto') return <Mini dark={theme === 'dark'} />;
  // Half light, half dark: the dark card shows only on the left half
  return (
    <span className="relative block">
      <Mini dark={false} />
      <span className="absolute inset-y-0 end-0 w-1/2 overflow-hidden">
        <span className="absolute inset-y-0 end-0 block w-[200%]">
          <Mini dark />
        </span>
      </span>
    </span>
  );
}

export default async function AppearancePage() {
  const current = await currentTheme();
  const t = messages.account.appearance;
  return (
    <TaskPage title={t.title} back="/account/settings" backLabel={messages.account.back} wide>
      <p className="text-[15px] leading-8 text-neutral-700">{t.intro}</p>
      <form action={chooseThemeAction} className="mt-4 grid grid-cols-3 gap-2.5">
        {THEMES.map((k) => {
          const on = k === current;
          return (
            <button
              key={k}
              name="theme"
              value={k}
              aria-pressed={on}
              className={`flex flex-col gap-2 rounded-2xl border-2 p-2.5 text-start ${on ? 'border-brand-600 bg-brand-50' : 'border-neutral-200 hover:border-neutral-300'}`}
            >
              <Preview theme={k} />
              <span className="flex items-center gap-1.5 text-sm font-extrabold">
                <Icon name={THEME_ICONS[k]} className="size-4 shrink-0 text-brand-700" />
                {t.options[k].name}
                {on && (
                  <span className="ms-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
                    <Icon name="check" className="size-3.5" />
                  </span>
                )}
              </span>
              <span className="text-xs leading-5 text-neutral-600">{t.options[k].hint}</span>
            </button>
          );
        })}
      </form>
      <ul className="mt-6 space-y-2 text-sm leading-7 text-neutral-700">
        {t.notes.map((n) => (
          <li key={n} className="flex gap-2">
            <Icon name="check" className="mt-1.5 size-4 shrink-0 text-brand-700" />
            {n}
          </li>
        ))}
      </ul>
    </TaskPage>
  );
}
